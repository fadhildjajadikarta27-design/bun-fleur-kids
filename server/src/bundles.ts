// One best eligible package per checkout. Coupon discounts take precedence.
// Only one unit of each distinct product belongs to the package.
export interface BundleOffer {id:string;name:string;productIds:readonly string[];price:number;active:boolean}
export function bestBundle(offers:readonly BundleOffer[],lines:readonly {productType:string;quantity:number;unitPrice:number}[]){
 let best:{id:string;name:string;savings:number;allocations:number[]}|null=null;
 for(const offer of offers){
  if(!offer.active||offer.productIds.length<2||new Set(offer.productIds).size!==offer.productIds.length)continue;
  const indices=offer.productIds.map(id=>lines.findIndex(l=>l.productType===id&&l.quantity>0));
  if(indices.some(i=>i<0))continue;
  const normal=indices.reduce((n,i)=>n+lines[i]!.unitPrice,0);
  const savings=normal-offer.price;
  if(savings<=0||best&&best.savings>=savings)continue;
  const allocations=lines.map(()=>0);let cumulative=0,allocated=0;
  indices.forEach((index,i)=>{cumulative+=lines[index]!.unitPrice;const next=i===indices.length-1?savings:Math.floor(savings*cumulative/normal);allocations[index]=next-allocated;allocated=next;});
  best={id:offer.id,name:offer.name,savings,allocations};
 }
 return best;
}
