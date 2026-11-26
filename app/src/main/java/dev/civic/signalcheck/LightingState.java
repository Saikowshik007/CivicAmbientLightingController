package dev.civic.signalcheck;

import java.util.*;
import org.json.*;

/** Local desired settings. They are not controller readback. */
public final class LightingState {
    public int colorA=0x28D9E8,colorB=0xA36CFF,brightnessA=45,brightnessB=45,modeA=0,modeB=0;
    public int speed=3,flowMode=4,variant=0,flowSpeed=3,direction=0;
    public boolean power=true,linked=true,flow=false;
    public LightingState copy(){return fromJson(toJson());}
    public JSONObject toJson(){
        JSONObject j=new JSONObject();try{
            j.put("colorA",colorA).put("colorB",colorB).put("brightnessA",brightnessA).put("brightnessB",brightnessB)
            .put("modeA",modeA).put("modeB",modeB).put("speed",speed).put("flowMode",flowMode).put("variant",variant)
            .put("flowSpeed",flowSpeed).put("direction",direction).put("power",power).put("linked",linked).put("flow",flow);
        }catch(JSONException e){throw new IllegalStateException(e);}return j;
    }
    public static LightingState fromJson(JSONObject j){
        if(j==null)return new LightingState();
        try{return parse(j);}catch(JSONException|IllegalArgumentException e){return new LightingState();}
    }
    public static LightingState parse(JSONObject j) throws JSONException {
        LightingState s=new LightingState();
            s.colorA=j.getInt("colorA");s.colorB=j.getInt("colorB");s.brightnessA=j.getInt("brightnessA");s.brightnessB=j.getInt("brightnessB");
            s.modeA=j.getInt("modeA");s.modeB=j.getInt("modeB");s.speed=j.getInt("speed");s.flowMode=j.getInt("flowMode");s.variant=j.getInt("variant");
            s.flowSpeed=j.getInt("flowSpeed");s.direction=j.getInt("direction");s.power=j.getBoolean("power");s.linked=j.getBoolean("linked");s.flow=j.getBoolean("flow");
            s.commands();return s;
    }
    public List<byte[]> commands(){
        ArrayList<byte[]> result=new ArrayList<>();
        // Validate both families, even when inactive, before persisting/applying.
        byte[] rgb=AmbientProtocol.modes(modeA,modeB), flowing=AmbientProtocol.flow(flowMode,variant);
        result.add(rgb);result.add(AmbientProtocol.colors(colorA,colorB));result.add(AmbientProtocol.brightness(brightnessA,brightnessB));
        result.add(AmbientProtocol.rgbSpeed(speed));
        byte[] flowSpeedFrame=AmbientProtocol.flowSpeed(flowSpeed),directionFrame=AmbientProtocol.direction(direction);
        if(flow){result.add(flowing);result.add(flowSpeedFrame);result.add(directionFrame);}
        result.add(AmbientProtocol.power(power));return result;
    }
    public void setColor(int zone,int rgb){AmbientProtocol.range(rgb,0,0xffffff);if(linked||zone==0)colorA=rgb;if(linked||zone==1)colorB=rgb;flow=false;if(linked||zone==0)modeA=0;if(linked||zone==1)modeB=0;}
    public void setBrightness(int zone,int value){AmbientProtocol.range(value,0,100);if(linked||zone==0)brightnessA=value;if(linked||zone==1)brightnessB=value;}
    public void setMode(int zone,int mode){AmbientProtocol.modes(mode,mode);flow=false;if(linked||zone==0)modeA=mode;if(linked||zone==1)modeB=mode;}
    public static LinkedHashMap<String,LightingState> builtIns(){
        LinkedHashMap<String,LightingState> map=new LinkedHashMap<>();
        String[] names={"Glacier","Violet hour","Ember","Ocean","Rose","Clean white"};
        int[][] colors={{0x28d9e8,0x3978ff},{0x9755ff,0xf05ca8},{0xff7a30,0xffbd69},{0x126bff,0x28d9e8},{0xff4c84,0xff97b2},{0xffead2,0xffead2}};
        for(int i=0;i<names.length;i++){LightingState s=new LightingState();s.colorA=colors[i][0];s.colorB=colors[i][1];s.linked=false;map.put(names[i],s);}return map;
    }
}
