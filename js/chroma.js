/**
 * Green-screen keying and content crop for stills / video frames.
 */
export class ChromaKey {
  constructor({
    keyTolerancePad = 2,
    alphaMin = 18,
  } = {}) {
    this.pad = keyTolerancePad;
    this.alphaMin = alphaMin;
    this.work = document.createElement("canvas");
    this.workCtx = this.work.getContext("2d", { willReadFrequently: true });
    this.crop = document.createElement("canvas");
    this.cropCtx = this.crop.getContext("2d");
  }

  apply(source, destCanvas, destCtx, sw, sh) {
    if (destCanvas.width !== sw || destCanvas.height !== sh) {
      destCanvas.width = sw;
      destCanvas.height = sh;
    }
    destCtx.clearRect(0, 0, sw, sh);
    destCtx.drawImage(source, 0, 0, sw, sh);
    const img = destCtx.getImageData(0, 0, sw, sh);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const greenDom = g - Math.max(r, b);
      const isScreen = g > 140 && greenDom > 45 && r < 95 && b < 95;
      if (isScreen) {
        d[i + 3] = greenDom > 70 ? 0 : Math.round(((70 - greenDom) / 25) * 255);
      } else if (d[i + 3] > 0 && greenDom > 25 && g > 120) {
        d[i + 1] = Math.max(0, g - Math.min(greenDom, 60));
      }
    }
    destCtx.putImageData(img, 0, 0);
    return destCanvas;
  }

  contentBounds(imageData, alphaMin = this.alphaMin) {
    const { data, width, height } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > alphaMin) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  keyAndCrop(source, sw, sh) {
    this.apply(source, this.work, this.workCtx, sw, sh);
    const img = this.workCtx.getImageData(0, 0, sw, sh);
    const b = this.contentBounds(img);
    if (!b) return null;
    const x = Math.max(0, b.x - this.pad);
    const y = Math.max(0, b.y - this.pad);
    const w = Math.min(sw - x, b.w + this.pad * 2);
    const h = Math.min(sh - y, b.h + this.pad * 2);
    if (this.crop.width !== w || this.crop.height !== h) {
      this.crop.width = w;
      this.crop.height = h;
    } else {
      this.cropCtx.clearRect(0, 0, w, h);
    }
    this.cropCtx.drawImage(this.work, x, y, w, h, 0, 0, w, h);
    return this.crop;
  }

  /**
   * Key a video frame. By default keeps the full frame size (stable aspect every frame).
   * Tight content-crop makes walk width pulse as limbs move — avoid for walk cycles.
   */
  frameFromVideo(vid, { crop = false } = {}) {
    if (!vid || vid.readyState < 2) return null;
    const sw = vid.videoWidth || 544;
    const sh = vid.videoHeight || 544;
    if (crop) return this.keyAndCrop(vid, sw, sh);
    this.apply(vid, this.work, this.workCtx, sw, sh);
    return this.work;
  }
}
