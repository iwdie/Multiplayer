class Player {
  constructor(x, y, size, imageSrc, groupId = null) {
    this.x = x;
    this.y = y;
    this.size = size; // Using a single 'size' property
    this.image = new Image();
    this.image.src = imageSrc;
    this.groupId = groupId;

    // Server coordinates for smooth movement
    this.serverX = x;
    this.serverY = y;
    
    // Other properties
    this.username = '';
    this.busy = false;
    this.isRequestReceived = false;
  }

  draw() {
    // Draw the player using the dynamic size for both width and height
    c.drawImage(this.image, this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);

    // Also make the username font size responsive
    const fontSize = this.size / 4;
    c.font = `${fontSize}px sans-serif`;
    c.fillStyle = 'black';
    c.textAlign = 'center';

    const textY = this.y - this.size / 2 - 5; 

    if (this.username) {
      c.fillText(this.username, this.x, textY);
    }
  }

  // Proximity check is now also based on the player's dynamic size
  isMinglingWith(otherPlayer) {
    const dx = this.x - otherPlayer.x;
    const dy = this.y - otherPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // The mingle range scales with the player size
    return distance < this.size * 1.5; 
  }
}
