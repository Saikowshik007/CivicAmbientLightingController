package dev.civic.signalcheck;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import org.json.*;
import java.io.*;
import java.util.*;

/** Offline UI bridge. Only bundled appassets pages may load; no vehicle APIs. */
public final class MainActivity extends Activity {
    private WebView web;
    private BleController controller;
    private LightingState state;
    private JSONArray presets;
    private android.content.SharedPreferences prefs;
    private boolean destroyed,scanWhenGranted;
    private final Handler main=new Handler(Looper.getMainLooper());
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);getWindow().setStatusBarColor(Color.rgb(10,12,17));getWindow().setNavigationBarColor(Color.rgb(10,12,17));
        prefs=getSharedPreferences("ambient-controller",MODE_PRIVATE);
        try{state=LightingState.fromJson(new JSONObject(prefs.getString("state","{}")));}catch(JSONException e){state=new LightingState();}
        try{presets=new JSONArray(prefs.getString("presets","[]"));}catch(JSONException e){presets=new JSONArray();}
        controller=new BleController(this,s->emit("connection",s));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(10,12,17));setContentView(web);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Bridge(),"Native");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();String path=uri.getPath();
                if(!"https".equals(uri.getScheme())||!"appassets.androidplatform.net".equals(uri.getHost())||path==null||!path.startsWith("/assets/")||path.contains("..")||path.contains("\\"))return response(403,"Forbidden");
                String asset=path.substring(8);
                try{return new WebResourceResponse(asset.endsWith(".js")?"text/javascript":asset.endsWith(".css")?"text/css":asset.endsWith(".html")?"text/html":"application/octet-stream","UTF-8",getAssets().open(asset));}
                catch(IOException e){return response(404,"Not found");}
            }
        });
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }
    private WebResourceResponse response(int status,String message){return new WebResourceResponse("text/plain","UTF-8",status,message,Collections.emptyMap(),new ByteArrayInputStream(message.getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
    public final class Bridge {
        @JavascriptInterface public void postMessage(String json){if(json==null||json.length()>24000)return;main.post(()->{if(!destroyed)handle(json);});}
    }
    private void handle(String json){
        try{
            JSONObject action=new JSONObject(json);String type=action.getString("type");
            switch(type){
                case "ready":sendInitial();break;
                case "scan":if(controller.permitted())controller.scan();else{scanWhenGranted=true;requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},1);}break;
                case "stopScan":controller.stopScan();break;
                case "connect":controller.connect(action.getString("address"));break;
                case "disconnect":controller.disconnect();break;
                case "apply":state=LightingState.parse(action.getJSONObject("state"));persist();toast(controller.apply(state)?"Look submitted to controller":"Look saved locally. Connect a controller to apply.");break;
                case "power":state.power=action.getBoolean("on");persist();toast(controller.power(state.power)?"Power command submitted":"Power choice saved locally. Connect to apply.");break;
                case "savePreset":savePreset(action);break;
                case "deletePreset":deletePreset(action.getString("id"));break;
                default:toast("Unknown action");
            }
        }catch(JSONException|IllegalArgumentException e){toast("That setting could not be applied");}
    }
    private void persist(){prefs.edit().putString("state",state.toJson().toString()).putString("presets",presets.toString()).apply();}
    private void savePreset(JSONObject action)throws JSONException{
        String name=action.getString("name").trim();if(name.isEmpty()||name.length()>32){toast("Use a preset name between 1 and 32 characters");return;}
        LightingState selected=LightingState.parse(action.getJSONObject("state"));int existing=-1;
        for(int i=0;i<presets.length();i++)if(presets.getJSONObject(i).optString("name").equalsIgnoreCase(name)){existing=i;break;}
        if(existing<0&&presets.length()>=12){toast("You can save 12 presets. Remove one first.");return;}
        JSONObject preset=new JSONObject().put("id",existing>=0?presets.getJSONObject(existing).getString("id"):UUID.randomUUID().toString()).put("name",name).put("state",selected.toJson());
        if(existing>=0)presets.put(existing,preset);else presets.put(preset);persist();emit("presets",presets);toast("Preset saved on this head unit");
    }
    private void deletePreset(String id)throws JSONException{JSONArray next=new JSONArray();for(int i=0;i<presets.length();i++){JSONObject p=presets.getJSONObject(i);if(!id.equals(p.optString("id")))next.put(p);}presets=next;persist();emit("presets",presets);}
    private void sendInitial(){
        JSONObject initial=new JSONObject();JSONArray looks=new JSONArray();
        try{for(Map.Entry<String,LightingState> e:LightingState.builtIns().entrySet())looks.put(new JSONObject().put("name",e.getKey()).put("state",e.getValue().toJson()));
            initial.put("state",state.toJson()).put("presets",presets).put("looks",looks).put("connection",controller.snapshot()).put("native",true).put("version","0.2.0");
        }catch(JSONException ignored){}emit("initial",initial);
    }
    private void toast(String message){emit("message",message);}
    private void emit(String type,Object data){if(destroyed||web==null)return;String value=data instanceof JSONObject||data instanceof JSONArray?data.toString():JSONObject.quote(String.valueOf(data));web.evaluateJavascript("window.onNativeEvent && window.onNativeEvent("+JSONObject.quote(type)+","+value+")",null);}
    @Override public void onRequestPermissionsResult(int code,String[] names,int[] results){super.onRequestPermissionsResult(code,names,results);if(code==1){if(scanWhenGranted&&controller.permitted())controller.scan();else toast("Nearby devices permission is needed to connect your lights");scanWhenGranted=false;}}
    @Override protected void onPause(){controller.stopScan();web.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){destroyed=true;main.removeCallbacksAndMessages(null);if(controller!=null)controller.close();if(web!=null){web.removeJavascriptInterface("Native");web.destroy();}super.onDestroy();}
}
