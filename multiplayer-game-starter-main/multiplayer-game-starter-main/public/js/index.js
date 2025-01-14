const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()
const scoreEl = document.querySelector('#scoreEl')

canvas.width = innerWidth
canvas.height = innerHeight

const x = canvas.width / 2
const y = canvas.height / 2

const player = new Player(x, y, 10, 'white')
const players = {}

socket.on('updatePlayers', (BackendPlayers) => {
 for (const id in BackendPlayers) {
    const player = BackendPlayers[id]
    players[id] = new Player(player.x, player.y, 10, 'white')
  
  if(!players[id]){
    players[id] = new Player(x, y, 10, 'white')
  }
  else{
    players[id].x = player.x
    players[id].y = player.y
  }
}
   for (const id in players){
    if(!BackendPlayers[id]){
      delete players[id]
    }
   }


});


let animationId
 
function animate() {
  animationId = requestAnimationFrame(animate)
  c.fillStyle = 'rgba(193, 10, 110, 0.1)'
  c.fillRect(0, 0, canvas.width, canvas.height)
  for (const id in players) {
      const player = players[id]
      player.draw()
  }

 

   
}

animate()

const keys={
  w:{
    pressed:false
  },
  a:{
    pressed:false
  },
  s:{
    pressed:false
  },
  d:{
    pressed:false
  }
}

setInterval(() => { 
  if(keys.w.pressed){
    players[socket.id].y -= 10
    socket.emit('keydown','KeyW')
  }
  if(keys.a.pressed){
    players[socket.id].x -= 10
    socket.emit('keydown','KeyA')
  }
  if(keys.s.pressed){
    players[socket.id].y += 10
    socket.emit('keydown','KeyS')
  }
  if(keys.d.pressed){
    players[socket.id].x += 10
    socket.emit('keydown','KeyD')
  }
  
  

},15)

window.addEventListener('keydown',(event)=>{
  if(!players[socket.id]) return
  
  switch(event.code){
    case 'KeyW':
      keys.w.pressed = true
      break
    case 'KeyA':
      keys.a.pressed = true
      break
    case 'KeyS':
      keys.s.pressed = true
      break
    case 'KeyD':
      keys.d.pressed = true
      break
  }
})

window.addEventListener('keyup',(event)=>{
  if(!players[socket.id]) return
  
  switch(event.code){
    case 'KeyW':
      keys.w.pressed = false
      break
    case 'KeyA':
      keys.a.pressed = false
      break
    case 'KeyS':
      keys.s.pressed = false
      break
    case 'KeyD':
      keys.d.pressed = false
  }
})