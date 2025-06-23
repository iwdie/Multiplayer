// This script assumes a global 'keys' object is defined in index.js
// It will modify that object based on touch input.

// Get the HTML elements for the joystick
const joystickContainer = document.getElementById('joystick-container');
const joystickNub = document.getElementById('joystick-nub');

// Check if the joystick element exists to avoid errors on desktop
if (joystickContainer) {
    let isJoystickActive = false;
    let joystickStartX = 0;
    let joystickStartY = 0;
    
    // This is the maximum distance the nub can move from the center
    const maxRadius = joystickContainer.clientWidth / 4;

    // --- TOUCH START ---
    // When a finger first touches the joystick area
    joystickContainer.addEventListener('touchstart', (event) => {
        // Prevent the page from scrolling
        event.preventDefault();
        isJoystickActive = true;
        
        // Record the starting touch position
        const touch = event.touches[0];
        joystickStartX = touch.clientX;
        joystickStartY = touch.clientY;
    }, { passive: false });

    // --- TOUCH MOVE ---
    // When the finger is dragged
    joystickContainer.addEventListener('touchmove', (event) => {
        event.preventDefault();
        if (!isJoystickActive) return;

        const touch = event.touches[0];
        const currentX = touch.clientX;
        const currentY = touch.clientY;

        // Calculate the vector from the start position to the current position
        const deltaX = currentX - joystickStartX;
        const deltaY = currentY - joystickStartY;
        
        // Calculate distance and angle
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);

        // Move the visual nub for feedback, but cap its distance
        const nubX = Math.min(maxRadius, distance) * Math.cos(angle);
        const nubY = Math.min(maxRadius, distance) * Math.sin(angle);
        joystickNub.style.transform = `translate(${nubX}px, ${nubY}px)`;
        
        // Reset all key states before setting new ones
        keys.w.pressed = false;
        keys.a.pressed = false;
        keys.s.pressed = false;
        keys.d.pressed = false;

        // If the stick is pushed far enough, determine the direction
        if (distance > 20) { // 20px deadzone
            // Prioritize vertical or horizontal movement to avoid unintended diagonals
            const angleDeg = Math.abs(angle * 180 / Math.PI);
            
            if (deltaY < -20 && angleDeg > 45 && angleDeg < 135) {
                keys.w.pressed = true; // Up
            } else if (deltaY > 20 && angleDeg > 45 && angleDeg < 135) {
                keys.s.pressed = true; // Down
            }
            
            if (deltaX < -20 && (angleDeg > 135 || angleDeg < 45)) {
                 keys.a.pressed = true; // Left
            } else if (deltaX > 20 && (angleDeg > 135 || angleDeg < 45)) {
                keys.d.pressed = true; // Right
            }
        }
    }, { passive: false });

    // --- TOUCH END ---
    // When the finger is lifted
    joystickContainer.addEventListener('touchend', (event) => {
        event.preventDefault();
        isJoystickActive = false;
        
        // Reset the visual nub and all key states
        joystickNub.style.transform = `translate(0px, 0px)`;
        keys.w.pressed = false;
        keys.a.pressed = false;
        keys.s.pressed = false;
        keys.d.pressed = false;
    });
}
