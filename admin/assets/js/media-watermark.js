(function(root){
  "use strict";

  var WEBSITE="www.mindobirdwatching.com";
  var LOGO_URL="/assets/images/app/mbw-watermark-logo.png";
  var logoPromise=null;

  function normalized(options){
    options=options||{};
    return{logo:options.logo===true,url:options.url===true};
  }

  function variantSuffix(options){
    var selected=normalized(options),parts=[];
    if(selected.logo)parts.push("logo");
    if(selected.url)parts.push("url");
    return parts.length?"-"+parts.join("-"):"";
  }

  function layout(width,height,options){
    var selected=normalized(options);
    var bottom=Math.max(34,Math.round(height*.058));
    var fontSize=Math.max(24,Math.round(width*.043));
    var logoSize=Math.max(76,Math.round(Math.min(width*.16,height*.145)));
    var gap=Math.max(12,Math.round(height*.012));
    var urlBaseline=height-bottom;
    var logoY=selected.url?urlBaseline-fontSize-gap-logoSize:height-bottom-logoSize;
    return{
      bottom:bottom,
      fontSize:fontSize,
      logoSize:logoSize,
      logoX:Math.round((width-logoSize)/2),
      logoY:Math.round(logoY),
      urlX:Math.round(width/2),
      urlBaseline:Math.round(urlBaseline),
      logoOpacity:.6
    };
  }

  function loadImage(source){
    return new Promise(function(resolve,reject){
      var image=new Image(),objectUrl=typeof source==="string"?"":URL.createObjectURL(source);
      image.onload=function(){if(objectUrl)URL.revokeObjectURL(objectUrl);resolve(image)};
      image.onerror=function(){if(objectUrl)URL.revokeObjectURL(objectUrl);reject(new Error("The watermark image could not be loaded."))};
      image.src=objectUrl||source;
    });
  }

  function loadLogo(){
    if(!logoPromise)logoPromise=loadImage(LOGO_URL).catch(function(error){logoPromise=null;throw error});
    return logoPromise;
  }

  function canvasBlob(canvas,type){
    return new Promise(function(resolve,reject){
      var quality=type==="image/jpeg"||type==="image/webp"?0.94:undefined;
      canvas.toBlob(function(blob){if(blob)resolve(blob);else reject(new Error("The watermarked image could not be created."))},type,quality);
    });
  }

  async function render(blob,options){
    var selected=normalized(options);
    if(!selected.logo&&!selected.url)return blob;
    var source=await loadImage(blob),width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
    if(!width||!height)throw new Error("The source image dimensions could not be read.");
    var canvas=document.createElement("canvas"),context=canvas.getContext("2d"),mark=layout(width,height,selected);
    if(!context)throw new Error("Watermark rendering is unavailable in this browser.");
    canvas.width=width;canvas.height=height;context.drawImage(source,0,0,width,height);
    if(selected.logo){
      var logo=await loadLogo();
      context.save();context.globalAlpha=mark.logoOpacity;context.drawImage(logo,mark.logoX,mark.logoY,mark.logoSize,mark.logoSize);context.restore();
    }
    if(selected.url){
      var fontSize=mark.fontSize,maxWidth=width*.9;
      context.save();context.textAlign="center";context.textBaseline="alphabetic";context.font="700 "+fontSize+"px Arial, Helvetica, sans-serif";
      while(context.measureText(WEBSITE).width>maxWidth&&fontSize>18){fontSize-=2;context.font="700 "+fontSize+"px Arial, Helvetica, sans-serif"}
      context.fillStyle="#fff";context.shadowColor="rgba(0,0,0,.72)";context.shadowBlur=Math.max(3,Math.round(fontSize*.12));context.shadowOffsetY=Math.max(2,Math.round(fontSize*.08));context.fillText(WEBSITE,mark.urlX,mark.urlBaseline);context.restore();
    }
    var requested=String(blob.type||"").toLowerCase(),type=["image/jpeg","image/png","image/webp"].includes(requested)?requested:"image/jpeg";
    return canvasBlob(canvas,type);
  }

  root.MBWMediaWatermark={render:render,layout:layout,variantSuffix:variantSuffix,website:WEBSITE,logoUrl:LOGO_URL,logoOpacity:.6};
})(typeof window!=="undefined"?window:globalThis);
