import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/screen-container';
import { CropMark, Icon, palette } from '@/components/crop/ui';
import { PolicyLinks } from '@/components/web/info-screen';

export function StudioWordmark() {
  return <View style={styles.wordmark}><CropMark size={25} /><Text style={styles.name}>GameShot</Text><Text style={styles.labs}>LABS</Text></View>;
}
export function StudioScreen({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const router = useRouter();
  return <ScreenContainer style={{ backgroundColor: palette.bg }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
    <View style={styles.header}><Pressable accessibilityLabel="Back to GameShot LABS studio" onPress={() => router.push('/')}><StudioWordmark /></Pressable><Pressable style={styles.navLink} onPress={() => router.push('/exports')}><Icon name="layers-outline" size={16} /><Text style={styles.muted}>Exports →</Text></Pressable></View>
    <Pressable style={styles.back} onPress={() => router.push('/')}><Icon name="arrow-back" size={14} /><Text style={styles.muted}>Studio</Text></Pressable>
    <Text role="heading" aria-level={1} style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>
    {children}<PolicyLinks />
  </ScrollView></ScreenContainer>;
}
export function Field({ label, value, onChange, numeric, disabled }: { label: string; value: string; onChange:(value:string)=>void; numeric?:boolean; disabled?:boolean }) {
  return <View style={{ flex:1, minWidth:115 }}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChange} keyboardType={numeric ? 'number-pad' : 'default'} editable={!disabled} placeholderTextColor={palette.muted} /></View>;
}
export function Options<T extends string>({ label, value, options, onChange, disabled }: { label:string; value:T; options:{id:T;title:string}[]; onChange:(value:T)=>void; disabled?:boolean }) {
  return <View style={{ gap:8 }}><Text style={styles.fieldLabel}>{label}</Text><View style={{ flexDirection:'row',flexWrap:'wrap',gap:8 }}>{options.map(option=><Pressable key={option.id} disabled={disabled} accessibilityRole="button" accessibilityState={{selected:value===option.id,disabled}} onPress={()=>onChange(option.id)} style={[styles.option,value===option.id&&styles.optionActive]}><Text style={{ color:value===option.id?palette.lime:palette.muted,fontSize:12 }}>{option.title}</Text></Pressable>)}</View></View>;
}
export function Toggle({ label, checked, onChange, disabled }: {label:string;checked:boolean;onChange:()=>void;disabled?:boolean}) {
  return <Pressable disabled={disabled} accessibilityRole="checkbox" accessibilityState={{checked,disabled}} onPress={onChange} style={styles.toggle}><Icon name={checked?'checkbox':'square-outline'} size={20} color={checked?palette.lime:palette.muted}/><Text style={styles.muted}>{label}</Text></Pressable>;
}
export const studioStyles=StyleSheet.create({ panel:{backgroundColor:palette.panel,borderWidth:1,borderColor:palette.line,borderRadius:14,padding:20,gap:18,marginTop:20},row:{flexDirection:'row',flexWrap:'wrap',gap:12},copy:{color:palette.muted,fontSize:12,lineHeight:19},label:{color:palette.lime,fontSize:10,letterSpacing:1.2},title:{color:palette.text,fontSize:19,fontWeight:'600'} });
const styles=StyleSheet.create({page:{padding:22,paddingBottom:34,width:'100%',maxWidth:1080,alignSelf:'center'},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,paddingBottom:25,borderBottomWidth:1,borderBottomColor:palette.line},wordmark:{flexDirection:'row',alignItems:'center',gap:9},name:{color:palette.text,fontSize:22,fontWeight:'700',letterSpacing:-.8},labs:{color:palette.lime,fontSize:9,letterSpacing:2,borderWidth:1,borderColor:palette.line,paddingHorizontal:7,paddingVertical:5},navLink:{flexDirection:'row',alignItems:'center',gap:7,minHeight:44},back:{flexDirection:'row',gap:8,alignItems:'center',paddingTop:20,paddingBottom:10,minHeight:44},muted:{color:palette.muted,fontSize:12,lineHeight:19},title:{color:palette.text,fontSize:32,fontWeight:'600',letterSpacing:-1,marginTop:12},subtitle:{color:palette.muted,fontSize:13,lineHeight:21,marginTop:9,maxWidth:620},fieldLabel:{color:palette.muted,fontSize:10,letterSpacing:.7,marginBottom:6},input:{backgroundColor:palette.bg,color:palette.text,borderWidth:1,borderColor:palette.line,borderRadius:8,minHeight:45,paddingHorizontal:12,fontSize:14},option:{borderWidth:1,borderColor:palette.line,borderRadius:8,paddingHorizontal:13,minHeight:44,justifyContent:'center'},optionActive:{borderColor:palette.lime,backgroundColor:'#c5f76a0c'},toggle:{flexDirection:'row',gap:10,alignItems:'center',minHeight:44}});
