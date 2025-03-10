class horses {
    constructor(x, y, width, height, imageSrc, glowColor) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.image = new Image();
      this.image.src = imageSrc;
      this.angle = 0; // Initial angle in radians
      this.image.onload = () => {
        this.loaded = true; // Ensure the image is loaded before drawing
      };
      this.loaded = false;
  
      this.glowColor = glowColor; // Color for the glow effect
    }
  
    draw() {
      if (this.loaded) {
        c.save(); // Save the current canvas state
        c.translate(this.x, this.y); // Move the canvas origin to the image's center
        c.rotate(this.angle); // Rotate the canvas
  

        c.beginPath();
        c.arc(0, 0, this.width * 1.6, 0, Math.PI * 2); // Slightly larger than the image
        c.fillStyle = "rgb(214, 89, 0)"; // Fill with orange color
        c.fill();
        c.closePath();
  

        // Set glow effect
        c.shadowBlur = 25; // Intensity of the glow
        c.shadowColor = this.glowColor; // Color of the glow
        c.shadowOffsetX = 2; // No horizontal shadow offset
        c.shadowOffsetY = 2; // No vertical shadow offset
  
        // Draw the image with the glow effect
        c.drawImage(
          this.image,
          -this.width / 2,
          -this.height / 2,
          this.width,
          this.height
        );
  
        c.restore(); // Restore the canvas state
      }
    }
  
    update() {
      this.angle += 0.01; // Increment the angle to create rotation (adjust speed here)
    }
  }
  