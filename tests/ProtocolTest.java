package dev.civic.signalcheck;

import java.nio.file.*;
import java.util.*;
import org.json.*;

/** Known vectors plus cross-language fixtures and state preservation checks. */
public final class ProtocolTest {
    private static int checks;
    private static final JSONArray fixtures=new JSONArray();
    private static void check(boolean condition,String message){checks++;if(!condition)throw new AssertionError(message);}
    private static void vector(String family,int[] input,byte[] bytes)throws Exception{fixtures.put(new JSONObject().put("family",family).put("input",new JSONArray(input)).put("hex",AmbientProtocol.hex(bytes).replace(" ","")));}
    private static void invalid(Runnable action){boolean failed=false;try{action.run();}catch(IllegalArgumentException e){failed=true;}check(failed,"Invalid command accepted");}
    public static void main(String[] args)throws Exception{
        check(AmbientProtocol.hex(AmbientProtocol.connected()).equals("FC 01 00 FE FA"),"Handshake");
        check(AmbientProtocol.hex(AmbientProtocol.requestEffects()).equals("FC 01 01 FD FA"),"Effect request");
        check(AmbientProtocol.hex(AmbientProtocol.power(false)).equals("FC 02 05 00 F8 FA"),"Power off");
        for(int a=0;a<=100;a++)for(int b=0;b<=100;b++)vector("brightness",new int[]{a,b},AmbientProtocol.brightness(a,b));
        int[] channels={0,1,127,128,254,255};for(int r:channels)for(int g:channels)for(int b:channels){int a=(r<<16)|(g<<8)|b,other=(b<<16)|(r<<8)|g;vector("colors",new int[]{a,other},AmbientProtocol.colors(a,other));}
        for(int a:new int[]{0,1,2,3,4,6})for(int b:new int[]{0,1,2,3,4,6})vector("modes",new int[]{a,b},AmbientProtocol.modes(a,b));
        for(int mode=4;mode<=14;mode++)for(int variant=0;variant<(mode==10?2:6);variant++)vector("flow",new int[]{mode,variant},AmbientProtocol.flow(mode,variant));
        invalid(()->AmbientProtocol.brightness(-1,1));invalid(()->AmbientProtocol.brightness(1,101));invalid(()->AmbientProtocol.colors(0x1000000,0));invalid(()->AmbientProtocol.modes(5,0));invalid(()->AmbientProtocol.flow(10,2));invalid(()->AmbientProtocol.rgbSpeed(0));invalid(()->AmbientProtocol.direction(2));
        LightingState s=new LightingState();s.linked=false;int other=s.colorB;s.setColor(0,0xff0000);check(s.colorB==other,"Changing zone A damaged zone B");
        s.setBrightness(1,12);check(s.brightnessA==45&&s.brightnessB==12,"Independent brightness");s.setMode(1,2);check(s.modeA==0&&s.modeB==2,"Independent effects");
        s.linked=true;s.setColor(1,0x123456);check(s.colorA==0x123456&&s.colorB==0x123456,"Linked colors");s.setBrightness(0,70);check(s.brightnessA==70&&s.brightnessB==70,"Linked brightness");
        s.flow=true;s.flowMode=10;s.variant=1;s.power=false;LightingState restored=LightingState.parse(new JSONObject(s.toJson().toString()));check(restored.toJson().toString().equals(s.toJson().toString()),"Preset roundtrip");
        check(AmbientProtocol.hex(restored.commands().get(restored.commands().size()-1)).equals("FC 02 05 00 F8 FA"),"Preset ignored power choice");
        JSONObject broken=s.toJson();broken.put("variant",5);boolean rejected=false;try{LightingState.parse(broken);}catch(IllegalArgumentException e){rejected=true;}check(rejected,"Malformed preset accepted");
        check(LightingState.fromJson(broken).brightnessA==45,"Corrupted storage did not reset");
        for(LightingState preset:LightingState.builtIns().values())check(!preset.commands().isEmpty(),"Invalid built-in");
        Files.writeString(Path.of(args[0]),fixtures.toString());System.out.println("PASS: "+checks+" state/boundary checks; "+fixtures.length()+" differential vectors generated");
    }
}
