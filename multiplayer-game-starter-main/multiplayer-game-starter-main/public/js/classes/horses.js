class horses {
  constructor(x, y, size, imageSrc, glowColor) {
    this.x = x;
    this.y = y;
    this.size = size; // Using a single 'size' property
    this.image = new Image();
    this.image.src = imageSrc;
    this.angle = 0; 
    this.image.onload = () => {
      this.loaded = true;
    };
    this.loaded = false;

    this.glowColor = glowColor;
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
