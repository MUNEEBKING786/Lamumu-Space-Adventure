class LamumuSpaceGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Device detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // Game state
        this.gameState = 'start'; // 'start', 'playing', 'gameOver'
        this.score = 0;
        this.tokens = 0;
        this.gameSpeed = 2;
        this.powerupActive = false;
        this.powerupTime = 0;
        
        // Canvas dimensions (logical size)
        this.gameWidth = 800;
        this.gameHeight = 600;
        
        // Audio management
        this.musicEnabled = true;
        this.soundEnabled = true;
        this.audioContext = null;
        this.audioElements = {};
        
        // Asset management
        this.assets = {};
        this.assetPaths = {
            cow: 'assets/cow.png',
            commondot_logo: 'assets/commondot_logo.png'
        };
        
        // Player (Cow)
        this.player = {
            x: 100,
            y: this.gameHeight / 2,
            width: 60,
            height: 50,
            velocityY: 0,
            gravity: 0.6,
            jumpForce: -12,
            rotation: 0,
            trail: []
        };
        
        // Game objects
        this.obstacles = [];
        this.powerups = [];
        this.particles = [];
        this.stars = [];
        this.backgroundObjects = [];
        
        // Controls
        this.keys = {};
        this.touchStartY = 0;
        
        this.init();
    }
    
    async init() {
        this.setupCanvas();
        await this.loadAssets();
        this.initAudio();
        this.setupEventListeners();
        this.generateStars();
        this.generateBackgroundObjects();
        this.gameLoop();
        this.createBackgroundParticles();
    }
    
    setupCanvas() {
        // Set canvas display size
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Set actual canvas size (logical game size)
        this.canvas.width = this.gameWidth;
        this.canvas.height = this.gameHeight;
        
        // Scale context to fit display
        const scaleX = rect.width / this.gameWidth;
        const scaleY = rect.height / this.gameHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Center the game area
        const offsetX = (rect.width - this.gameWidth * scale) / 2;
        const offsetY = (rect.height - this.gameHeight * scale) / 2;
        
        // Reset player position
        this.player.y = this.gameHeight / 2;
        
        // Adjust canvas size for mobile
        if (this.isMobile) {
            const container = document.getElementById('gameContainer');
            const maxWidth = Math.min(window.innerWidth * 0.95, 800);
            const maxHeight = Math.min(window.innerHeight * 0.8, 600);
            const aspectRatio = this.gameWidth / this.gameHeight;
            
            let width = maxWidth;
            let height = width / aspectRatio;
            
            if (height > maxHeight) {
                height = maxHeight;
                width = height * aspectRatio;
            }
            
            this.canvas.style.width = width + 'px';
            this.canvas.style.height = height + 'px';
        }
    }
    
    async loadAssets() {
        for (let key in this.assetPaths) {
            try {
                const img = new Image();
                img.src = this.assetPaths[key];
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    setTimeout(reject, 3000);
                });
                this.assets[key] = img;
            } catch (e) {
                console.log(`Asset ${key} not found, using fallback`);
                this.assets[key] = null;
            }
        }
    }
    
    initAudio() {
        // Initialize audio elements
        this.audioElements = {
            backgroundMusic: document.getElementById('backgroundMusic'),
            jumpSound: document.getElementById('jumpSound'),
            collectSound: document.getElementById('collectSound'),
            gameOverSound: document.getElementById('gameOverSound')
        };
        
        // Set volume levels
        this.audioElements.backgroundMusic.volume = 0.3;
        this.audioElements.jumpSound.volume = 0.4;
        this.audioElements.collectSound.volume = 0.5;
        this.audioElements.gameOverSound.volume = 0.6;
        
        // Handle audio context for mobile
        if (this.isMobile) {
            const unlockAudio = () => {
                Object.values(this.audioElements).forEach(audio => {
                    audio.play().then(() => audio.pause()).catch(() => {});
                });
                document.removeEventListener('touchstart', unlockAudio);
                document.removeEventListener('touchend', unlockAudio);
            };
            document.addEventListener('touchstart', unlockAudio);
            document.addEventListener('touchend', unlockAudio);
        }
    }
    
    playSound(soundName) {
        if (!this.soundEnabled || !this.audioElements[soundName]) return;
        
        try {
            this.audioElements[soundName].currentTime = 0;
            this.audioElements[soundName].play().catch(e => console.log('Sound play failed:', e));
        } catch (e) {
            console.log('Sound error:', e);
        }
    }
    
    setupEventListeners() {
        // Button events
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('backToMenuBtn').addEventListener('click', () => this.backToMenu());
        document.getElementById('musicToggle').addEventListener('click', () => this.toggleMusic());
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if ((e.code === 'Space' || e.code === 'ArrowUp') && this.gameState === 'playing') {
                e.preventDefault();
                this.jump();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Mouse/touch controls
        this.canvas.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.gameState === 'playing') {
                this.jump();
            }
        });
        
        // Mobile touch controls
        if (this.isTouch) {
            const jumpBtn = document.getElementById('jumpBtn');
            
            // Touch events for jump button
            jumpBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.gameState === 'playing') {
                    this.jump();
                    jumpBtn.style.transform = 'translateX(-50%) scale(0.95)';
                }
            });
            
            jumpBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                jumpBtn.style.transform = 'translateX(-50%) scale(1)';
            });
            
            // Touch events for canvas
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.touchStartY = e.touches[0].clientY;
                if (this.gameState === 'playing') {
                    this.jump();
                }
            });
            
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
            });
            
            this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
            });
        }
        
        // Prevent context menu on mobile
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.setupCanvas(), 100);
        });
        
        // Handle resize
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        const btn = document.getElementById('musicToggle');
        
        if (this.musicEnabled) {
            btn.textContent = '🔊 MUSIC ON';
            if (this.gameState === 'playing') {
                this.playSound('backgroundMusic');
            }
        } else {
            btn.textContent = '🔇 MUSIC OFF';
            this.audioElements.backgroundMusic.pause();
        }
    }
    
    startGame() {
        this.gameState = 'playing';
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameUI').classList.remove('hidden');
        this.resetGameState();
        
        if (this.musicEnabled) {
            this.playSound('backgroundMusic');
        }
    }
    
    restartGame() {
        this.gameState = 'playing';
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('gameUI').classList.remove('hidden');
        this.resetGameState();
        
        if (this.musicEnabled) {
            this.playSound('backgroundMusic');
        }
    }
    
    backToMenu() {
        this.gameState = 'start';
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('startScreen').classList.remove('hidden');
        this.audioElements.backgroundMusic.pause();
    }
    
    resetGameState() {
        this.score = 0;
        this.tokens = 0;
        this.gameSpeed = 2;
        this.player.y = this.gameHeight / 2;
        this.player.velocityY = 0;
        this.player.rotation = 0;
        this.player.trail = [];
        this.obstacles = [];
        this.powerups = [];
        this.particles = [];
        this.powerupActive = false;
        this.powerupTime = 0;
        this.updateUI();
    }
    
    jump() {
        this.player.velocityY = this.player.jumpForce;
        this.createJumpParticles();
        this.playSound('jumpSound');
        
        // Add to trail
        this.player.trail.unshift({
            x: this.player.x + this.player.width / 2,
            y: this.player.y + this.player.height / 2,
            alpha: 1
        });
        
        if (this.player.trail.length > 8) {
            this.player.trail.pop();
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Update player
        this.player.velocityY += this.player.gravity;
        this.player.y += this.player.velocityY;
        
        // Update rotation based on velocity
        this.player.rotation = Math.max(-0.5, Math.min(0.5, this.player.velocityY * 0.05));
        
        // Update trail
        this.player.trail.forEach((point, index) => {
            point.alpha -= 0.15;
        });
        this.player.trail = this.player.trail.filter(point => point.alpha > 0);
        
        // Boundary check
        if (this.player.y < 0) {
            this.player.y = 0;
            this.player.velocityY = 0;
        }
        if (this.player.y + this.player.height > this.gameHeight) {
            this.gameOver();
        }
        
        // Update game objects
        this.updateObstacles();
        this.updatePowerups();
        this.updateParticles();
        this.updateBackgroundObjects();
        this.updatePowerupSystem();
        
        // Spawn new objects
        this.spawnObstacles();
        this.spawnPowerups();
        
        // Update score and speed
        this.score += 1;
        this.gameSpeed += 0.002;
        
        // Check collisions
        this.checkCollisions();
        
        this.updateUI();
    }
    
    updateObstacles() {
        this.obstacles.forEach(obstacle => {
            obstacle.x -= this.gameSpeed * 2;
            
            // Update obstacle-specific animations
            if (obstacle.type === 'laser_beam') {
                obstacle.pulsePhase += 0.2;
                obstacle.intensity = 0.8 + Math.sin(obstacle.pulsePhase) * 0.2;
            } else if (obstacle.type === 'energy_ball') {
                obstacle.rotation += 0.15;
                obstacle.pulsePhase += 0.12;
                obstacle.scale = 1 + Math.sin(obstacle.pulsePhase) * 0.15;
            } else if (obstacle.type === 'plasma_wall') {
                obstacle.wavePhase += 0.1;
            }
        });
        
        this.obstacles = this.obstacles.filter(obstacle => obstacle.x + obstacle.width > 0);
    }
    
    updatePowerups() {
        this.powerups.forEach(powerup => {
            powerup.x -= this.gameSpeed * 2;
            powerup.rotation += 0.1;
            powerup.pulsePhase += 0.15;
            powerup.scale = 1 + Math.sin(powerup.pulsePhase) * 0.2;
        });
        
        this.powerups = this.powerups.filter(powerup => powerup.x + powerup.width > 0);
    }
    
    updateParticles() {
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha -= particle.decay;
            particle.size *= 0.98;
        });
        
        this.particles = this.particles.filter(particle => particle.alpha > 0 && particle.size > 0.5);
    }
    
    updateBackgroundObjects() {
        this.backgroundObjects.forEach(obj => {
            obj.x -= this.gameSpeed * obj.speed;
            if (obj.type === 'distant_star') {
                obj.twinklePhase += 0.05;
            } else if (obj.type === 'nebula_cloud') {
                obj.driftPhase += 0.02;
            }
        });
        
        this.backgroundObjects = this.backgroundObjects.filter(obj => obj.x + obj.width > 0);
        
        // Spawn new background objects
        if (Math.random() < 0.002) {
            this.spawnBackgroundObject();
        }
    }
    
    updatePowerupSystem() {
        if (this.powerupActive) {
            this.powerupTime -= 1;
            if (this.powerupTime <= 0) {
                this.powerupActive = false;
            }
        }
        
        const powerupBar = document.getElementById('powerupBar');
        const percentage = this.powerupActive ? (this.powerupTime / 300) * 100 : 0;
        powerupBar.style.setProperty('--powerup-width', percentage + '%');
    }
    
    spawnObstacles() {
        // Increased frequency - spawn more often and ensure proper spacing
        if (this.obstacles.length === 0 || this.obstacles[this.obstacles.length - 1].x < this.gameWidth - 200) {
            const types = ['laser_beam', 'energy_ball', 'plasma_wall'];
            const type = types[Math.floor(Math.random() * types.length)];
            
            let obstacle;
            
            if (type === 'laser_beam') {
                obstacle = {
                    type: 'laser_beam',
                    x: this.gameWidth,
                    y: Math.max(50, Math.min(this.gameHeight - 170, Math.random() * (this.gameHeight - 200) + 50)),
                    width: 15,
                    height: 120,
                    pulsePhase: 0,
                    intensity: 1,
                    color: '#FF0040'
                };
            } else if (type === 'energy_ball') {
                obstacle = {
                    type: 'energy_ball',
                    x: this.gameWidth,
                    y: Math.max(50, Math.min(this.gameHeight - 120, Math.random() * (this.gameHeight - 140) + 50)),
                    width: 70,
                    height: 70,
                    rotation: 0,
                    pulsePhase: 0,
                    scale: 1,
                    color: '#FF4000'
                };
            } else {
                obstacle = {
                    type: 'plasma_wall',
                    x: this.gameWidth,
                    y: Math.max(30, Math.min(this.gameHeight - 200, Math.random() * (this.gameHeight - 220) + 30)),
                    width: 25,
                    height: 160,
                    wavePhase: 0,
                    color: '#8000FF'
                };
            }
            
            this.obstacles.push(obstacle);
        }
    }
    
    spawnPowerups() {
        if (Math.random() < 0.004 && (!this.powerups.length || this.powerups[this.powerups.length - 1].x < this.gameWidth - 200)) {
            const powerup = {
                x: this.gameWidth,
                y: Math.max(70, Math.min(this.gameHeight - 120, Math.random() * (this.gameHeight - 140) + 70)),
                width: 50,
                height: 50,
                rotation: 0,
                scale: 1,
                pulsePhase: 0
            };
            this.powerups.push(powerup);
        }
    }
    
    spawnBackgroundObject() {
        const types = ['distant_star', 'nebula_cloud'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        if (type === 'distant_star') {
            const obj = {
                type: 'distant_star',
                x: this.gameWidth,
                y: Math.random() * this.gameHeight,
                width: 4 + Math.random() * 8,
                height: 4 + Math.random() * 8,
                speed: 0.1 + Math.random() * 0.2,
                twinklePhase: Math.random() * Math.PI * 2,
                color: `hsl(${200 + Math.random() * 60}, 70%, 80%)`
            };
            this.backgroundObjects.push(obj);
        } else {
            const obj = {
                type: 'nebula_cloud',
                x: this.gameWidth,
                y: Math.random() * (this.gameHeight - 150) + 75,
                width: 100 + Math.random() * 100,
                height: 80 + Math.random() * 60,
                speed: 0.05 + Math.random() * 0.1,
                driftPhase: Math.random() * Math.PI * 2,
                color: `hsl(${180 + Math.random() * 80}, 40%, 25%)`
            };
            this.backgroundObjects.push(obj);
        }
    }
    
    checkCollisions() {
        // Check obstacle collisions
        this.obstacles.forEach(obstacle => {
            if (this.isColliding(this.player, obstacle) && !this.powerupActive) {
                this.gameOver();
            }
        });
        
        // Check powerup collisions
        this.powerups.forEach((powerup, index) => {
            if (this.isColliding(this.player, powerup)) {
                this.collectPowerup(powerup);
                this.powerups.splice(index, 1);
            }
        });
    }
    
    isColliding(rect1, rect2) {
        // Add some padding for more forgiving collision detection
        const padding = 5;
        return rect1.x + padding < rect2.x + rect2.width - padding &&
               rect1.x + rect1.width - padding > rect2.x + padding &&
               rect1.y + padding < rect2.y + rect2.height - padding &&
               rect1.y + rect1.height - padding > rect2.y + padding;
    }
    
    collectPowerup(powerup) {
        this.tokens += 10;
        this.powerupActive = true;
        this.powerupTime = 300;
        this.createCollectionParticles(powerup.x, powerup.y);
        this.playSound('collectSound');
    }
    
    createJumpParticles() {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: this.player.x + this.player.width / 2,
                y: this.player.y + this.player.height,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 3 + 1,
                size: Math.random() * 6 + 2,
                alpha: 1,
                decay: 0.02,
                color: `hsl(${200 + Math.random() * 60}, 80%, 70%)`
            });
        }
    }
    
    createCollectionParticles(x, y) {
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                size: Math.random() * 8 + 3,
                alpha: 1,
                decay: 0.03,
                color: `hsl(${Math.random() * 60 + 300}, 80%, 70%)`
            });
        }
    }
    
    generateStars() {
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * this.gameWidth,
                y: Math.random() * this.gameHeight,
                size: Math.random() * 2 + 1,
                twinkle: Math.random() * Math.PI * 2,
                speed: 0.5 + Math.random() * 1.5
            });
        }
    }
    
    generateBackgroundObjects() {
        for (let i = 0; i < 5; i++) {
            this.spawnBackgroundObject();
        }
    }
    
    createBackgroundParticles() {
        setInterval(() => {
            if (this.gameState === 'playing') {
                this.particles.push({
                    x: this.gameWidth,
                    y: Math.random() * this.gameHeight,
                    vx: -this.gameSpeed * 0.5,
                    vy: 0,
                    size: Math.random() * 3 + 1,
                    alpha: 0.6,
                    decay: 0.005,
                    color: '#ffffff'
                });
            }
        }, 200);
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.gameWidth, this.gameHeight);
        
        // Draw background elements first (so they appear behind everything else)
        this.drawStars();
        this.drawBackgroundObjects();
        
        // Draw game objects
        this.drawObstacles();
        this.drawPowerups();
        this.drawPlayer();
        this.drawParticles();
        
        // Draw power-up effects
        if (this.powerupActive) {
            this.drawPowerupEffects();
        }
    }
    
    drawStars() {
        this.ctx.fillStyle = 'white';
        this.stars.forEach(star => {
            star.twinkle += 0.05;
            star.x -= star.speed * this.gameSpeed * 0.1;
            
            // Wrap stars around
            if (star.x < 0) {
                star.x = this.gameWidth;
                star.y = Math.random() * this.gameHeight;
            }
            
            const alpha = 0.3 + Math.sin(star.twinkle) * 0.2;
            this.ctx.globalAlpha = alpha;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }
    
    drawBackgroundObjects() {
        this.backgroundObjects.forEach(obj => {
            this.ctx.save();
            
            if (obj.type === 'distant_star') {
                // Draw very faint, distant stars
                this.ctx.globalAlpha = 0.4 + Math.sin(obj.twinklePhase) * 0.2;
                this.ctx.fillStyle = obj.color;
                this.ctx.shadowColor = obj.color;
                this.ctx.shadowBlur = 6;
                this.ctx.beginPath();
                this.ctx.arc(obj.x, obj.y, obj.width / 2, 0, Math.PI * 2);
                this.ctx.fill();
                
            } else if (obj.type === 'nebula_cloud') {
                // Draw very faint, background nebula clouds
                this.ctx.globalAlpha = 0.15;
                const gradient = this.ctx.createRadialGradient(
                    obj.x + obj.width / 2, obj.y + obj.height / 2, 0,
                    obj.x + obj.width / 2, obj.y + obj.height / 2, obj.width / 2
                );
                gradient.addColorStop(0, obj.color);
                gradient.addColorStop(1, 'transparent');
                
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.ellipse(
                    obj.x + obj.width / 2, obj.y + obj.height / 2,
                    obj.width / 2, obj.height / 2, 0, 0, Math.PI * 2
                );
                this.ctx.fill();
            }
            
            this.ctx.restore();
        });
    }
    
    drawPlayer() {
        this.ctx.save();
        
        // Draw trail
        this.player.trail.forEach((point, index) => {
            this.ctx.globalAlpha = point.alpha * 0.6;
            this.ctx.fillStyle = this.powerupActive ? '#ff6b6b' : '#00d4ff';
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 8 - index, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.globalAlpha = 1;
        
        // Transform for rotation
        this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
        this.ctx.rotate(this.player.rotation);
        
        if (this.assets.cow) {
            this.ctx.drawImage(this.assets.cow, -this.player.width / 2, -this.player.height / 2, this.player.width, this.player.height);
        } else {
            this.drawCosmicCow();
        }
        
        // Power-up glow effect
        if (this.powerupActive) {
            this.ctx.shadowColor = '#ff6b6b';
            this.ctx.shadowBlur = 20;
            this.ctx.strokeStyle = '#ff6b6b';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(-this.player.width / 2 - 5, -this.player.height / 2 - 5, this.player.width + 10, this.player.height + 10);
            this.ctx.shadowBlur = 0;
        }
        
        this.ctx.restore();
    }
    
    drawCosmicCow() {
        this.ctx.fillStyle = this.powerupActive ? '#ff9999' : '#ffffff';
        
        // Body
        this.ctx.fillRect(-25, -20, 40, 25);
        
        // Head
        this.ctx.fillRect(-30, -25, 20, 15);
        
        // Spots
        this.ctx.fillStyle = this.powerupActive ? '#cc0000' : '#000000';
        this.ctx.beginPath();
        this.ctx.arc(-15, -10, 4, 0, Math.PI * 2);
        this.ctx.arc(-5, -5, 3, 0, Math.PI * 2);
        this.ctx.arc(10, -15, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Eyes
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(-28, -22, 2, 2);
        this.ctx.fillRect(-24, -22, 2, 2);
        
        // Legs
        this.ctx.fillStyle = this.powerupActive ? '#ff9999' : '#ffffff';
        this.ctx.fillRect(-20, 5, 4, 8);
        this.ctx.fillRect(-10, 5, 4, 8);
        this.ctx.fillRect(0, 5, 4, 8);
        this.ctx.fillRect(10, 5, 4, 8);
    }
    
    drawObstacles() {
        this.obstacles.forEach(obstacle => {
            this.ctx.save();
            
            if (obstacle.type === 'laser_beam') {
                // Bright, dangerous laser beam - very visible
                this.ctx.globalAlpha = obstacle.intensity;
                
                // Outer glow
                this.ctx.shadowColor = obstacle.color;
                this.ctx.shadowBlur = 25;
                this.ctx.fillStyle = obstacle.color;
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // Inner core - brighter
                this.ctx.shadowBlur = 15;
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(obstacle.x + 3, obstacle.y + 10, obstacle.width - 6, obstacle.height - 20);
                
                // Pulsing edges
                this.ctx.globalAlpha = 0.8;
                this.ctx.strokeStyle = obstacle.color;
                this.ctx.lineWidth = 4;
                this.ctx.strokeRect(obstacle.x - 2, obstacle.y - 2, obstacle.width + 4, obstacle.height + 4);
                
            } else if (obstacle.type === 'energy_ball') {
                this.ctx.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
                this.ctx.rotate(obstacle.rotation);
                this.ctx.scale(obstacle.scale, obstacle.scale);
                
                // Outer energy ring
                this.ctx.shadowColor = obstacle.color;
                this.ctx.shadowBlur = 30;
                this.ctx.strokeStyle = obstacle.color;
                this.ctx.lineWidth = 8;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, obstacle.width / 2, 0, Math.PI * 2);
                this.ctx.stroke();
                
                // Inner core
                const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, obstacle.width / 3);
                gradient.addColorStop(0, '#FFFFFF');
                gradient.addColorStop(0.5, obstacle.color);
                gradient.addColorStop(1, 'rgba(255, 0, 64, 0.3)');
                
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, obstacle.width / 3, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Crackling energy lines
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + obstacle.rotation;
                    const x1 = Math.cos(angle) * (obstacle.width / 4);
                    const y1 = Math.sin(angle) * (obstacle.width / 4);
                    const x2 = Math.cos(angle) * (obstacle.width / 2.5);
                    const y2 = Math.sin(angle) * (obstacle.width / 2.5);
                    
                    this.ctx.strokeStyle = '#FFFF00';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x1, y1);
                    this.ctx.lineTo(x2, y2);
                    this.ctx.stroke();
                }
                
            } else if (obstacle.type === 'plasma_wall') {
                // Vertical plasma wall with wavy energy
                this.ctx.shadowColor = obstacle.color;
                this.ctx.shadowBlur = 20;
                
                // Main wall
                this.ctx.fillStyle = obstacle.color;
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // Bright inner core
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(obstacle.x + 5, obstacle.y + 15, obstacle.width - 10, obstacle.height - 30);
                
                // Wavy energy patterns
                this.ctx.strokeStyle = '#FF00FF';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                for (let y = obstacle.y; y < obstacle.y + obstacle.height; y += 10) {
                    const waveX = obstacle.x + obstacle.width / 2 + Math.sin(y * 0.1 + obstacle.wavePhase) * 8;
                    if (y === obstacle.y) this.ctx.moveTo(waveX, y);
                    else this.ctx.lineTo(waveX, y);
                }
                this.ctx.stroke();
                
                // Electric sparks
                for (let i = 0; i < 3; i++) {
                    const sparkY = obstacle.y + Math.random() * obstacle.height;
                    const sparkX = obstacle.x + obstacle.width + Math.random() * 15;
                    
                    this.ctx.fillStyle = '#FFFF00';
                    this.ctx.beginPath();
                    this.ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            
            this.ctx.restore();
        });
    }
    
    drawPowerups() {
        this.powerups.forEach(powerup => {
            this.ctx.save();
            
            this.ctx.translate(powerup.x + powerup.width / 2, powerup.y + powerup.height / 2);
            this.ctx.rotate(powerup.rotation);
            this.ctx.scale(powerup.scale, powerup.scale);
            
            // Outer glow
            this.ctx.shadowColor = '#00d4ff';
            this.ctx.shadowBlur = 25;
            
            if (this.assets.commondot_logo) {
                this.ctx.drawImage(this.assets.commondot_logo, -powerup.width / 2, -powerup.height / 2, powerup.width, powerup.height);
            } else {
                this.drawCommondotLogo(powerup.width, powerup.height);
            }
            
            // Pulsing ring effect
            this.ctx.strokeStyle = '#00d4ff';
            this.ctx.lineWidth = 3;
            this.ctx.globalAlpha = 0.5 + Math.sin(powerup.pulsePhase) * 0.3;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, powerup.width / 2 + 10, 0, Math.PI * 2);
            this.ctx.stroke();
            
            this.ctx.restore();
        });
    }
    
    drawCommondotLogo(width, height) {
        this.ctx.fillStyle = '#00d4ff';
        
        // Central dot
        this.ctx.beginPath();
        this.ctx.arc(0, 0, width / 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Surrounding elements
        this.ctx.fillStyle = '#4ecdc4';
        this.ctx.fillRect(-width/4, -height/8, width/2, height/4);
        
        // Corner dots
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.beginPath();
        this.ctx.arc(-width/3, -height/3, 3, 0, Math.PI * 2);
        this.ctx.arc(width/3, -height/3, 3, 0, Math.PI * 2);
        this.ctx.arc(-width/3, height/3, 3, 0, Math.PI * 2);
        this.ctx.arc(width/3, height/3, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Text representation
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '8px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('XYZ', 0, height/2 - 2);
    }
    
    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.shadowColor = particle.color;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
    
    drawPowerupEffects() {
        // Screen border glow
        this.ctx.save();
        this.ctx.strokeStyle = '#ff6b6b';
        this.ctx.lineWidth = 8;
        this.ctx.shadowColor = '#ff6b6b';
        this.ctx.shadowBlur = 30;
        this.ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
        this.ctx.strokeRect(0, 0, this.gameWidth, this.gameHeight);
        this.ctx.restore();
    }
    
    updateUI() {
        document.getElementById('score').textContent = Math.floor(this.score / 10);
        document.getElementById('tokens').textContent = this.tokens;
    }
    
    gameOver() {
        this.gameState = 'gameOver';
        this.audioElements.backgroundMusic.pause();
        this.playSound('gameOverSound');
        
        document.getElementById('gameUI').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.remove('hidden');
        
        // Update final scores
        document.getElementById('finalScore').textContent = `Distance: ${Math.floor(this.score / 10)}`;
        document.getElementById('finalTokens').textContent = `Tokens: ${this.tokens}`;
        
        this.generateAchievements();
    }
    
    generateAchievements() {
        const achievements = [];
        const finalScore = Math.floor(this.score / 10);
        
        if (finalScore > 50) achievements.push('🚀 Space Explorer');
        if (finalScore > 200) achievements.push('🌟 Stellar Navigator');
        if (finalScore > 500) achievements.push('🌌 Cosmic Champion');
        if (finalScore > 1000) achievements.push('👑 Galaxy Master');
        if (this.tokens > 30) achievements.push('💎 Token Collector');
        if (this.tokens > 80) achievements.push('💰 Treasure Hunter');
        if (this.tokens > 150) achievements.push('🏆 Wealth Master');
        if (this.powerupActive) achievements.push('⚡ Power User');
        if (finalScore > 100 && this.tokens > 50) achievements.push('🎯 Perfect Balance');
        
        const achievementsDiv = document.getElementById('achievements');
        achievementsDiv.innerHTML = achievements.map(achievement => 
            `<div class="achievement">${achievement}</div>`
        ).join('');
    }
    
    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new LamumuSpaceGame();
    
    // Create floating background particles
    const particleBg = document.getElementById('particleBg');
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = star.style.height = Math.random() * 3 + 1 + 'px';
        star.style.animationDelay = Math.random() * 3 + 's';
        particleBg.appendChild(star);
    }
    
    // Create floating particles
    setInterval(() => {
        const particle = document.createElement('div');
        particle.className = 'floating-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = Math.random() * 4 + 4 + 's';
        particle.style.animationDelay = Math.random() * 2 + 's';
        particleBg.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 8000);
    }, 300);
});

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}