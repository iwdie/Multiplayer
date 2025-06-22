class Player {
  // Add groupId as a property
  constructor(x, y, width, height, imageSrc, groupId = null) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.image = new Image();
    this.image.src = imageSrc; // Set the image source
    this.groupId = groupId; // Initialize groupId
    this.username = ''; 
    
    // ADDED: State properties to be synced from server
    this.busy = false;
    this.isRequestReceived = false;
  }

  // in public/js/Player.js
draw() {
  // First, draw the player image as before
  c.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

  // --- Add this new code to draw the name ---

  // Set the properties for the text
  c.font = '12px sans-serif';
  c.fillStyle = 'black';
  c.textAlign = 'center'; // This makes the text centered above the player

  // Calculate the position for the text to be above the player's head
  const textX = this.x;
  const textY = this.y - this.height / 2 - 5; // 5 pixels above the image

  // Draw the player's username
  // The 'this.username' property should be updated by the 'updatePlayers' event listener
  if (this.username) {
    c.fillText(this.username, textX, textY);
  }
}

  // Method to check proximity with another player
  isMinglingWith(otherPlayer) {
    const dx = this.x - otherPlayer.x;
    const dy = this.y - otherPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Adjust mingle range. Increased slightly to make it easier to trigger.
    return distance < Math.max(this.width, this.height) + 70; // Adjust mingle range
  }
}