export function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function loadAssets() {
  const [boat, diver, beacon, cargo, rescue] = await Promise.all([
    loadImage('/assets/img/boat.svg'),
    loadImage('/assets/img/diver.svg'),
    loadImage('/assets/img/beacon.svg'),
    loadImage('/assets/img/cargo.svg'),
    loadImage('/assets/img/rescue.svg')
  ]);

  return { boat, diver, beacon, cargo, rescue };
}
