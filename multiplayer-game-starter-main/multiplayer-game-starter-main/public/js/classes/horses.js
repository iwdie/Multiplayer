class horses {
  constructor(x, y, size, imageSrc, glowColor) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.image = new Image();
    this.angle = 0;
    this.loaded = false;
    this.glowColor = glowColor;

    // --- CORRECTED ORDER ---
    // 1. Set up the onload function first.
    this.image.onload = () => {
      this.loaded = true;
    };
    
    // 2. Then, set the src to start the download.
    this.image.src = imageSrc;
  }

  draw() {
    if (this.loaded) {
      c.save();
      c.translate(this.x, this.y);
      c.rotate(this.angle);

      // The glow effect also scales with the horse's size
      c.beginPath();
      c.arc(0, 0, this.size * 0.8, 0, Math.PI * 2);
      c.fillStyle = "rgb(214, 89, 0)";
      c.fill();
      c.closePath();

      c.shadowBlur = 25;
      c.shadowColor = this.glowColor;
      c.shadowOffsetX = 2;
      c.shadowOffsetY = 2;

      // Draw the image using the dynamic size
      c.drawImage(
        this.image,
        -this.size / 2,
        -this.size / 2,
        this.size,
        this.size
      );

      c.restore();
    }
  }

  update() {
    this.angle += 0.01;
  }
}
