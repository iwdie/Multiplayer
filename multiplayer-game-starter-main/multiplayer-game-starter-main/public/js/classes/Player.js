class Player {
  constructor(x, y, size, imageSrc) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.image = new Image();
    
    // --- FIX: Add a 'loaded' flag ---
    this.loaded = false;
    this.image.onload = () => {
      // This function runs ONLY when the image has finished downloading
      this.loaded = true;
    };
    
    this.image.src = imageSrc;

    // Properties for server-side state and smoothing
    this.serverX = x;
    this.serverY = y;
    this.username = '';
    this.groupId = null;
    this.busy = false;
    this.isRequestReceived = false;
  }

  draw() {
    // --- FIX: Only draw if the image is loaded ---
    if (this.loaded) {
      // Draw the player image
      c.drawImage(this.image, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
      
      // Draw the username as well
      if (this.username) {
        const fontSize = this.size / 4;
        c.font = `${fontSize}px sans-serif`;
        c.fillStyle = 'black';
        c.textAlign = 'center';
        c.fillText(this.username, this.x, this.y - this.size / 2 - 5);
      }
    }
  }

  isMinglingWith(otherPlayer) {
    const dx = this.x - otherPlayer.x;
    const dy = this.y - otherPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // The mingle range scales with the player size
    return distance < this.size * 1.5; 
  }
}
