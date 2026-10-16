import { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { ActionButton, Icon, palette } from '@/components/crop/ui';
import { useCrop } from '@/lib/crop/store';
import { exportItems } from '@/lib/crop/export-tools';
import type { SourceImage } from '@/lib/crop/types';
import { Options, studioStyles } from './ui';

export function useStudioSources() {
  const crop=useCrop();
  const [choice,setChoiceState]=useState<'imports'|'exports'>('imports');
  const [selectedIds,setSelectedIds]=useState<string[]|null>(null);
  const sources=useMemo<SourceImage[]>(()=>choice==='imports'?crop.images:crop.batches[0]?exportItems(crop.batches[0]).map(({output,name})=>({id:output.id,uri:output.uri,name,width:output.width,height:output.height,size:output.size})):[],[choice,crop.images,crop.batches]);
  const selected=sources.filter(source=>selectedIds===null||selectedIds.includes(source.id));
  function toggle(id:string){setSelectedIds(old=>{const ids=old??sources.map(s=>s.id);return ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];});}
  return {crop,choice,sources,selected,toggle,selectAll:()=>setSelectedIds(null),setChoice:(value:'imports'|'exports')=>{setChoiceState(value);setSelectedIds(null);}};
}
export function StudioSources({state,disabled}: {state:ReturnType<typeof useStudioSources>;disabled:boolean}) {
  return <View style={studioStyles.panel}><Text style={studioStyles.label}>01 / SOURCE IMAGES</Text>
    <Options label="Use images from" value={state.choice} options={[{id:'imports',title:'Imported originals'},{id:'exports',title:'Latest crop exports'}]} onChange={state.setChoice} disabled={disabled}/>
    <Text style={studioStyles.copy}>{state.choice==='exports'?'Uses the latest batch’s preferred export order.':'Uses the order received from your image picker.'} Selected images are never sorted by filename.</Text>
    <View style={studioStyles.row}><ActionButton title={state.crop.picking?'Opening images…':'Add images'} icon="add" secondary disabled={disabled||state.crop.picking||state.crop.processing} onPress={()=>void state.crop.addImages()}/><ActionButton title={`Select all (${state.sources.length})`} secondary disabled={disabled||!state.sources.length} onPress={state.selectAll}/></View>
    {!state.sources.length?<Text style={studioStyles.copy}>{state.choice==='exports'?'Create a crop batch first, or switch to imported originals.':'Add images to start. Your originals stay untouched.'}</Text>:<View style={{gap:8}}>{state.sources.map((source,index)=><Pressable key={source.id} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{checked:state.selected.some(s=>s.id===source.id),disabled}} accessibilityLabel={`${source.name}, input position ${index+1}`} onPress={()=>state.toggle(source.id)} style={{flexDirection:'row',alignItems:'center',gap:12,padding:8,borderWidth:1,borderColor:palette.line,borderRadius:8,minHeight:64}}><Icon name={state.selected.some(s=>s.id===source.id)?'checkbox':'square-outline'} size={20} color={palette.lime}/><Image source={{uri:source.uri}} style={{width:54,height:42,borderRadius:4}} resizeMode="contain"/><View style={{flex:1}}><Text style={{color:palette.text,fontSize:12}} numberOfLines={1}>{String(index+1).padStart(2,'0')} · {source.name}</Text><Text style={studioStyles.copy}>{source.width} × {source.height} px</Text></View></Pressable>)}</View>}
    <Text style={studioStyles.copy}>{state.selected.length} selected · free up to 3 / larger batches with verified Pro</Text>
  </View>;
}
