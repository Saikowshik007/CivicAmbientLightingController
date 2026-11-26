package dev.civic.signalcheck;

import android.Manifest;
import android.bluetooth.*;
import android.bluetooth.le.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import org.json.*;
import java.util.*;
import java.util.function.Consumer;

/** All mutable transport state is confined to the main looper. No queued replay across reconnect. */
final class BleController implements AutoCloseable {
    private final Context context;
    private final Consumer<JSONObject> change;
    private final Handler main=new Handler(Looper.getMainLooper());
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic write;
    private BluetoothLeScanner scanner;
    private ScanCallback scan;
    private final LinkedHashMap<String,JSONObject> devices=new LinkedHashMap<>();
    private final ArrayDeque<byte[]> queue=new ArrayDeque<>();
    private boolean ready,closed,pumping;
    private String status="Connect your lighting controller",device="",lastWrite="",lastNotification="";
    private int submitted,busyRetries;
    private static final UUID CCCD=UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private final Runnable scanTimeout=this::stopScan;
    private final Runnable connectTimeout=()->fail("Connection timed out. Retry near the controller.");
    private final Runnable pumpTask=this::pump;
    BleController(Context context,Consumer<JSONObject> change){this.context=context;this.change=change;}
    boolean permitted(){return context.checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)==PackageManager.PERMISSION_GRANTED && context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}
    JSONObject snapshot(){JSONObject j=new JSONObject();try{j.put("ready",ready).put("status",status).put("device",device).put("scanning",scan!=null).put("devices",new JSONArray(devices.values())).put("lastWrite",lastWrite).put("lastNotification",lastNotification).put("submitted",submitted);}catch(JSONException ignored){}return j;}
    private void emit(){if(!closed)change.accept(snapshot());}
    void scan(){
        if(closed)return;
        if(!permitted()){status="Allow Nearby devices to scan";emit();return;}
        stopScan();
        try{
            BluetoothManager manager=context.getSystemService(BluetoothManager.class);BluetoothAdapter adapter=manager==null?null:manager.getAdapter();
            if(adapter==null||!adapter.isEnabled()){status="Enable Bluetooth in the car settings";emit();return;}
            scanner=adapter.getBluetoothLeScanner();if(scanner==null){status="BLE scanning unavailable";emit();return;}
            devices.clear();
            scan=new ScanCallback(){
                @Override public void onScanResult(int type,ScanResult result){main.post(()->{
                    if(closed||scan!=this)return;
                    try{
                        String address=result.getDevice().getAddress();if(devices.size()>=60&&!devices.containsKey(address))return;
                        String name=result.getScanRecord()==null?null:result.getScanRecord().getDeviceName();
                        if(name==null||name.isBlank())name="Unnamed BLE device";
                        JSONObject d=new JSONObject().put("address",address).put("name",name).put("rssi",result.getRssi());
                        List<ParcelUuid> services=result.getScanRecord()==null?null:result.getScanRecord().getServiceUuids();
                        d.put("advertisesLighting",services!=null&&services.contains(new ParcelUuid(AmbientProtocol.SERVICE)));
                        devices.put(address,d);emit();
                    }catch(Exception e){status="Could not read scan result";emit();}
                });}
                @Override public void onScanFailed(int error){main.post(()->{if(scan!=this)return;stopScan();status="Scan failed ("+error+"). Retry.";emit();});}
            };
            scanner.startScan(null,new ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),scan);
            status=ready?"Connected • scanning nearby":"Scanning for nearby controllers…";main.postDelayed(scanTimeout,10000);emit();
        }catch(RuntimeException e){stopScan();status="Scan unavailable: "+e.getClass().getSimpleName();emit();}
    }
    void stopScan(){main.removeCallbacks(scanTimeout);ScanCallback old=scan;scan=null;if(scanner!=null&&old!=null)try{scanner.stopScan(old);}catch(RuntimeException ignored){}if(old!=null){status=ready?"Connected • ready":"Scan finished • select your controller";emit();}}
    void connect(String address){
        if(closed||!permitted()){status="Nearby devices permission required";emit();return;}
        if(!BluetoothAdapter.checkBluetoothAddress(address)){status="Invalid Bluetooth address";emit();return;}
        stopScan();release();lastWrite="";lastNotification="";submitted=0;
        try{
            BluetoothAdapter adapter=context.getSystemService(BluetoothManager.class).getAdapter();
            JSONObject entry=devices.get(address);device=entry==null?"Lighting controller":entry.optString("name","Lighting controller");
            status="Connecting to "+device+"…";emit();
            gatt=adapter.getRemoteDevice(address).connectGatt(context,false,callback,BluetoothDevice.TRANSPORT_LE);
            if(gatt==null){fail("Bluetooth connection could not start");return;}main.postDelayed(connectTimeout,20000);
        }catch(RuntimeException e){fail("Connection failed: "+e.getClass().getSimpleName());}
    }
    private final BluetoothGattCallback callback=new BluetoothGattCallback(){
        private void post(BluetoothGatt value,Runnable action){main.post(()->{if(closed||value!=gatt){value.close();return;}action.run();});}
        @Override public void onConnectionStateChange(BluetoothGatt value,int code,int state){post(value,()->{
            if(code!=BluetoothGatt.GATT_SUCCESS||state==BluetoothProfile.STATE_DISCONNECTED){fail("Disconnected ("+code+") • tap Connect to retry");return;}
            if(state==BluetoothProfile.STATE_CONNECTED){status="Checking lighting services…";emit();try{if(!value.discoverServices())fail("Service discovery rejected");}catch(RuntimeException e){fail("Service discovery unavailable");}}
        });}
        @Override public void onServicesDiscovered(BluetoothGatt value,int code){post(value,()->{
            if(code!=BluetoothGatt.GATT_SUCCESS){fail("Service discovery failed ("+code+")");return;}
            BluetoothGattService service=value.getService(AmbientProtocol.SERVICE);write=service==null?null:service.getCharacteristic(AmbientProtocol.WRITE);
            if(write==null||(write.getProperties()&BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)==0){fail("This device does not match the lighting controller");return;}
            BluetoothGattCharacteristic notify=service.getCharacteristic(AmbientProtocol.NOTIFY);
            BluetoothGattDescriptor descriptor=notify==null?null:notify.getDescriptor(CCCD);
            try{
                if(notify!=null&&(notify.getProperties()&BluetoothGattCharacteristic.PROPERTY_NOTIFY)!=0&&descriptor!=null){
                    if(!value.setCharacteristicNotification(notify,true)||value.writeDescriptor(descriptor,BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)!=BluetoothStatusCodes.SUCCESS){fail("Controller notification setup failed");return;}
                    status="Finishing controller connection…";emit();
                }else becomeReady();
            }catch(RuntimeException e){fail("Bluetooth permission or connection changed");}
        });}
        @Override public void onDescriptorWrite(BluetoothGatt value,BluetoothGattDescriptor descriptor,int code){post(value,()->{if(!CCCD.equals(descriptor.getUuid()))return;if(code==BluetoothGatt.GATT_SUCCESS)becomeReady();else fail("Controller setup rejected ("+code+")");});}
        @Override public void onCharacteristicChanged(BluetoothGatt value,BluetoothGattCharacteristic characteristic,byte[] bytes){final byte[] copy=bytes.clone();post(value,()->{lastNotification=AmbientProtocol.hex(copy);emit();});}
        @Override public void onCharacteristicWrite(BluetoothGatt value,BluetoothGattCharacteristic characteristic,int code){post(value,()->{if(code!=BluetoothGatt.GATT_SUCCESS)fail("Bluetooth write failed ("+code+"). Reconnect before retrying.");});}
    };
    private void becomeReady(){main.removeCallbacks(connectTimeout);ready=true;status="Connected • ready";queue.add(AmbientProtocol.connected());queue.add(AmbientProtocol.requestEffects());pump();emit();}
    boolean apply(LightingState state){if(!ready||closed){status="Connect a matching controller to apply this look";emit();return false;}queue.clear();busyRetries=0;for(byte[] bytes:state.commands())queue.add(bytes.clone());if(!pumping)pump();return true;}
    boolean power(boolean on){if(!ready)return false;queue.clear();queue.add(AmbientProtocol.power(on));if(!pumping)pump();return true;}
    private void pump(){
        pumping=false;if(!ready||gatt==null||write==null||queue.isEmpty()||closed)return;
        byte[] bytes=queue.removeFirst();
        try{
            int code=gatt.writeCharacteristic(write,bytes,BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
            if(code==BluetoothStatusCodes.ERROR_GATT_WRITE_REQUEST_BUSY && busyRetries++<3){queue.addFirst(bytes);pumping=true;main.postDelayed(pumpTask,200);return;}
            if(code!=BluetoothStatusCodes.SUCCESS){fail("Bluetooth did not accept the command ("+code+")");return;}
            busyRetries=0;
            submitted++;lastWrite=AmbientProtocol.hex(bytes);pumping=true;emit();main.postDelayed(pumpTask,160);
        }catch(RuntimeException e){fail("Bluetooth write unavailable • reconnect to retry");}
    }
    void disconnect(){stopScan();release();device="";status="Disconnected";emit();}
    private void fail(String message){release();status=message;emit();}
    private void release(){ready=false;write=null;queue.clear();pumping=false;busyRetries=0;main.removeCallbacks(pumpTask);main.removeCallbacks(connectTimeout);BluetoothGatt old=gatt;gatt=null;if(old!=null){try{old.disconnect();}catch(RuntimeException ignored){}try{old.close();}catch(RuntimeException ignored){}}}
    @Override public void close(){stopScan();release();closed=true;main.removeCallbacksAndMessages(null);}
}
