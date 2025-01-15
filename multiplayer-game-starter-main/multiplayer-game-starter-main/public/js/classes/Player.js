class Player {
  constructor(x, y, width, height, imageSrc) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
    this.image = new Image()
    this.image.src = imageSrc  // Set the image source
  }

  draw() {
    c.drawImage(this.image, this.x - this.width / 2, this.y - this.height / 2, this.width, this.height)
  }
}
