const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()
const scoreEl = document.querySelector('#scoreEl')

canvas.width = innerWidth
canvas.height = innerHeight

const x = canvas.width / 2
const y = canvas.height / 2
const player = new Player(x, y, 50, 50,'./images/image (2).png')
const horse = new horses(x, y, 180, 180, './images/horseswithbg-removebg-preview.png', 'rgba(248, 232, 84, 0.89)')

const backgroundMusic = new Audio('./sounds/mingle_sound.mp3'); // Path to your music file
backgroundMusic.loop = true; // Enable looping
backgroundMusic.volume = 0.5; // Adjust volume (range: 0.0 to 1.0)

// Add a button for the user to start the music

const startMusicButton = document.createElement('button');
startMusicButton.style.backgroundColor= 'black';
startMusicButton.textContent = '🎶';
startMusicButton.color = 'color:  rgb(241, 23, 150)';
startMusicButton.style.position = 'absolute';
startMusicButton.style.top = '10px';
startMusicButton.style.left = '10px';
startMusicButton.style.padding = '10px';
startMusicButton.style.fontSize = '16px';
startMusicButton.style.cursor = 'pointer';
document.body.appendChild(startMusicButton);

socket.on('gameOver', (data) => {
  console.log(data.message); // Log the message from the server

  // Display Game Over message
  const gameOverScreen = document.createElement('div');
  gameOverScreen.style.position = 'absolute';
  gameOverScreen.style.top = '50%';
  gameOverScreen.style.left = '50%';
  gameOverScreen.style.transform = 'translate(-50%, -50%)';
  gameOverScreen.style.padding = '20px';
  gameOverScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  gameOverScreen.style.color = 'white';
  gameOverScreen.style.fontSize = '30px';
  gameOverScreen.style.borderRadius = '10px';
  gameOverScreen.style.textAlign = 'center';
  gameOverScreen.style.boxShadow = '0 0 15px red';

  gameOverScreen.innerHTML = `<p>${data.message}</p>`;
  document.body.appendChild(gameOverScreen);

  // Stop further interactions (optional)
  cancelAnimationFrame(animationId); // Stop the animation
});


let totalTime = 10 * 60; // Total time in seconds (e.g., 10 minutes)
let timerInterval = null; // Store the timer interval

function startTimer() {
  if (timerInterval) return; // Prevent multiple timers

  timerInterval = setInterval(() => {
    if (totalTime > 0) {
      totalTime--; // Decrease total time
    } else {
      
      console.log('Time is up!');
      io.emit('endTimer');
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(timerInterval); // Stop any running timer
  timerInterval = null;
  totalTime = 10 * 60; // Reset timer
}

// Listen for timer events from the server
socket.on('startTimer', () => {
  console.log('Timer started!');
  startTimer(); // Start the timer
});

socket.on('resetTimer', () => {
  console.log('Timer reset!');
  resetTimer(); // Reset the timer
});

function drawTimer() {
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  // Set the box style (glowing effect)
  const boxWidth = 200;
  const boxHeight = 60;
  const boxX = canvas.width / 2 - boxWidth / 2;
  const boxY = 10;

  // Draw the silver box background
  c.fillStyle = 'rgba(14, 14, 14, 0.91)'; // Silver with slight transparency
  c.fillRect(boxX, boxY, boxWidth, boxHeight);

  // Add glowing effect to the box
  c.shadowColor = 'silver'; // Glow color
  c.shadowBlur = 15;
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(169, 169, 169, 0.9)'; // Darker silver for the border
  c.strokeRect(boxX, boxY, boxWidth, boxHeight);

  // Reset shadow effect for text
  c.shadowColor = 'transparent';

  // Draw the timer text inside the box
  c.font = '40px Arial'; // Font size and family
  c.textAlign = 'center'; // Center align the text
  c.fillStyle = 'red'; // Text color
  c.fillText(formattedTime, canvas.width / 2, boxY + boxHeight / 2 + 10); // Position the text

  // Reset the shadow effect to avoid applying it elsewhere
  c.shadowBlur = 0;
}







// Play the music when the button is clicked
startMusicButton.addEventListener('click', () => {
  backgroundMusic.play()
    .then(() => {
      console.log('Background music started');
      startMusicButton.style.display = 'none'; // Hide the button after music starts
    })
    .catch((error) => {
      console.error('Error playing background music:', error);
    });
});

const players = {}

socket.on('updatePlayers', (BackendPlayers) => {
 for (const id in BackendPlayers) {
    const player = BackendPlayers[id]
    players[id] = new Player(player.x, player.y, 50,50, './images/image (2).png')
  
  if(!players[id]){
    players[id] = new Player(x, y, 50, 50, './images/image (2).png')
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

let isDialogOpen = false; // Track dialog status
// Handle group updates
socket.on('groupUpdate', (groups) => {
  console.log('Group updates received:', groups);

  // Optional: Visualize groups (e.g., display in a sidebar)
});

// Handle mingle requests
socket.on('mingleRequested', (data) => {
  const { from, username } = data;
  openMingleDialog({ id: from, username });
});

// Handle responses from the server
socket.on('mingleSuccess', (group) => {
  console.log('Mingle success:', group);

  // Optional: Highlight group members visually
});

socket.on('mingleDeclined', (username) => {
  console.log(`${username} declined the mingle request.`);
});

socket.on('mingleTimeout', () => {
  console.log('Mingle request timed out.');
});

socket.on('groupUpdate', (groups) => {
  const groupList = document.querySelector('#groupList');
  groupList.innerHTML = ''; // Clear previous group data

  if (Object.keys(groups).length === 0) {
    groupList.innerHTML = '<p style="text-align: center;">No groups yet.</p>';
    return;
  }

  for (const groupId in groups) {
    const group = groups[groupId];
    const groupDiv = document.createElement('div');
    groupDiv.style.marginBottom = '15px';
    groupDiv.style.padding = '10px';
    groupDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    groupDiv.style.borderRadius = '5px';
    groupDiv.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.2)';

    groupDiv.innerHTML = `
      <strong style="color:  rgb(255, 0, 149);">Group ID:</strong> ${groupId}<br>
      <strong style="color:  rgb(255, 0, 149);">Members:</strong>
      <ul style="margin: 5px 0; padding-left: 20px; list-style: disc;">
        ${group
          .map((member) => `<li>${member.username} (Player ${member.id})</li>`)
          .join('')}
      </ul>
    `;
    groupList.appendChild(groupDiv);
  }
});


// Emit mingle request
function checkMingle() {
  for (const id1 in players) {
    for (const id2 in players) {
      if (id1 !== id2) {
        const player1 = players[id1];
        const player2 = players[id2];

        if (player1.isMinglingWith(player2) && !isDialogOpen) {
          socket.emit('requestMingle', id2);
          return; // Exit once a request is emitted
        }
      }
    }
  }
}

// Adjust mingle dialog
function openMingleDialog(request) {
  isDialogOpen = true;

  const dialog = document.createElement('div');
  dialog.style.position = 'absolute';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.padding = '20px';
  dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  dialog.style.color = 'white';
  dialog.style.borderRadius = '4px';
  dialog.style.textAlign = 'center';
  dialog.style.boxShadow = '0 0 15px pink';

  dialog.innerHTML = `
    <p>${request.username} wants to mingle! Do you accept?</p>
    <button id="mingleYes" style="margin: 10px; padding: 10px; background-color: blue; color: white;">Yes</button>
    <button id="mingleNo" style="margin: 10px; padding: 10px; background-color: red; color: white;">No</button>
  `;
  document.body.appendChild(dialog);

  document.getElementById('mingleYes').onclick = () => {
    socket.emit('respondMingle', { requestId: `${request.id}-${socket.id}`, accepted: true });
    document.body.removeChild(dialog);
    isDialogOpen = false;
  };

  document.getElementById('mingleNo').onclick = () => {
    socket.emit('respondMingle', { requestId: `${request.id}-${socket.id}`, accepted: false });
    document.body.removeChild(dialog);
    isDialogOpen = false;
  };
}


let animationId
 
function animate() {
  animationId = requestAnimationFrame(animate)
  c.fillStyle = 'rgba(248, 174, 94, 0.76)'; // Light orange with transparency
  c.fillRect(0, 0, canvas.width, canvas.height); // Fill the background with a fading effect

  horse.update()
  horse.draw()

  checkMingle();

  for (const id in players) {
      const player = players[id]
      player.draw()
  }

  drawTimer(); // Draw the timer on the canvas

   
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
    players[socket.id].y -= 5
    socket.emit('keydown','KeyW')
  }
  if(keys.a.pressed){
    players[socket.id].x -= 5
    socket.emit('keydown','KeyA')
  }
  if(keys.s.pressed){
    players[socket.id].y += 5
    socket.emit('keydown','KeyS')
  }
  if(keys.d.pressed){
    players[socket.id].x += 5
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

document.querySelector('#usernameForm').addEventListener('submit',(event)=>{
  event.preventDefault()
  
  socket.emit('initGame',document.querySelector('#usernameInput').value)
  document.querySelector('#usernameForm').style.display = 'none'
})

