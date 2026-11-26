package dev.civic.signalcheck;

import java.util.*;

/** Recreated packet format from com.findn.htx 1.1.1. No Bluetooth I/O. */
public final class AmbientProtocol {
    public static final UUID SERVICE=UUID.fromString("0000ffc0-0000-1000-8000-00805f9b34fb");
    public static final UUID WRITE=UUID.fromString("0000ffc1-0000-1000-8000-00805f9b34fb");
    public static final UUID NOTIFY=UUID.fromString("0000ffc2-0000-1000-8000-00805f9b34fb");
    private AmbientProtocol() {}
    private static byte[] frame(int command,int... data) {
        byte[] bytes=new byte[data.length+5];bytes[0]=(byte)252;bytes[1]=(byte)(data.length+1);bytes[2]=(byte)command;
        int sum=data.length+1+command;
        for(int i=0;i<data.length;i++){range(data[i],0,255);bytes[i+3]=(byte)data[i];sum+=data[i];}
        bytes[bytes.length-2]=(byte)~sum;bytes[bytes.length-1]=(byte)250;return bytes;
    }
    static void range(int value,int min,int max){if(value<min||value>max)throw new IllegalArgumentException("Value out of range: "+value);}
    public static byte[] connected(){return frame(0);}
    public static byte[] requestEffects(){return frame(1);}
    public static byte[] power(boolean on){return frame(5,on?1:0);}
    public static byte[] brightness(int a,int b){range(a,0,100);range(b,0,100);return frame(2,a,b);}
    public static byte[] colors(int a,int b){range(a,0,0xffffff);range(b,0,0xffffff);return frame(4,a>>16,(a>>8)&255,a&255,b>>16,(b>>8)&255,b&255);}
    public static byte[] modes(int a,int b){mode(a);mode(b);return frame(3,a,b);}
    private static void mode(int value){if(value!=0&&value!=1&&value!=2&&value!=3&&value!=4&&value!=6)throw new IllegalArgumentException("Unknown RGB effect");}
    public static byte[] rgbSpeed(int value){range(value,1,5);return frame(7,value);}
    public static byte[] flow(int mode,int variant){range(mode,4,14);range(variant,0,mode==10?1:5);return frame(34,mode|(variant<<4));}
    public static byte[] flowSpeed(int value){range(value,0,5);return frame(35,value);}
    public static byte[] direction(int value){range(value,0,1);return frame(36,value);}
    public static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(Locale.ROOT,"%02X ",b&255));return s.toString().trim();}
}
