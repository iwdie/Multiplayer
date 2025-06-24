class Player {
  constructor(x, y, width, height, imageSrc, groupId = null) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.image = new Image();
    
    // --- FIX: Add a 'loaded' flag ---
    this.loaded = false;
    this.image.onload = () => {
      // This function runs ONLY when the image has finished downloading
      this.loaded = true;
    };
    
    this.image.src = imageSrc;
    this.groupId = groupId;
    
    // Properties for server-side state and smoothing
    this.serverX = x;
    this.serverY = y;
    this.username = '';
    this.busy = false;
    this.isRequestReceived = false;
  }

  draw() {
    // --- FIX: Only draw if the image is loaded ---
    if (this.loaded) {
      c.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);
      
      // Draw the username as well
      if (this.username) {
        c.font = '12px sans-serif';
        c.fillStyle = 'black';
        c.textAlign = 'center';
        c.fillText(this.username, this.x, this.y - this.height / 2 - 5);
      }
    }
  }

  isMinglingWith(otherPlayer) {
    const dx = this.x - otherPlayer.x;
    const dy = this.y - otherPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.width + 20; // A simple proximity check
  }
}
