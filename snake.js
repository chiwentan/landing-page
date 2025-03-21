const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const restartButton = document.getElementById('restartButton');

let snake;
let dx;
let dy;
let foodX;
let foodY;
let changingDirection = false;
let score = 0;
let obstacles = [];
let gameSpeed = 100;

const main = () => {
    if (didGameEnd()) {
        showRestartButton();
        return;
    }

    setTimeout(() => {
        changingDirection = false;
        clearCanvas();
        drawFood();
        drawObstacles();
        advanceSnake();
        drawSnake();

        main();
    }, gameSpeed);
};

const clearCanvas = () => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const drawSnake = () => {
    snake.forEach(drawSnakePart);
};

const drawSnakePart = (snakePart) => {
    ctx.fillStyle = 'lightgreen';
    ctx.strokestyle = 'darkgreen';
    ctx.fillRect(snakePart.x, snakePart.y, 10, 10);
    ctx.strokeRect(snakePart.x, snakePart.y, 10, 10);
};

const advanceSnake = () => {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);

    const didEatFood = snake[0].x === foodX && snake[0].y === foodY;
    if (didEatFood) {
        score += 10;
        scoreDisplay.innerHTML = 'Score: ' + score;
        createFood();
        createObstacle();
        increaseSpeed();
    } else {
        snake.pop();
    }
};

const didGameEnd = () => {
    for (let i = 4; i < snake.length; i++) {
        const didCollide = snake[i].x === snake[0].x && snake[i].y === snake[0].y;
        if (didCollide) return true;
    }

    const hitLeftWall = snake[0].x < 0;
    const hitRightWall = snake[0].x > canvas.width - 10;
    const hitToptWall = snake[0].y < 0;
    const hitBottomWall = snake[0].y > canvas.height - 10;

    const hitObstacle = obstacles.some(obstacle => {
        return snake[0].x >= obstacle.x && snake[0].x < obstacle.x + obstacle.width &&
               snake[0].y >= obstacle.y && snake[0].y < obstacle.y + obstacle.height;
    });

    return hitLeftWall || hitRightWall || hitToptWall || hitBottomWall || hitObstacle;
};

const createFood = () => {
    foodX = Math.floor(Math.random() * 40) * 10;
    foodY = Math.floor(Math.random() * 40) * 10;

    snake.forEach((part) => {
        const hasEaten = part.x === foodX && part.y === foodY;
        if (hasEaten) createFood();
    });

    obstacles.forEach((obstacle) => {
        const isOnObstacle = foodX >= obstacle.x && foodX < obstacle.x + obstacle.width &&
                             foodY >= obstacle.y && foodY < obstacle.y + obstacle.height;
        if (isOnObstacle) createFood();
    });
};

const drawFood = () => {
    ctx.fillStyle = 'red';
    ctx.strokestyle = 'darkred';
    ctx.fillRect(foodX, foodY, 10, 10);
    ctx.strokeRect(foodX, foodY, 10, 10);
};

const createObstacle = () => {
    const obstacleX = Math.floor(Math.random() * 40) * 10;
    const obstacleY = Math.floor(Math.random() * 40) * 10;
    const obstacleWidth = (Math.floor(Math.random() * 2) + 1) * 10; // width between 10 and 20
    const obstacleHeight = (Math.floor(Math.random() * 2) + 1) * 10; // height between 10 and 20

    obstacles.push({ x: obstacleX, y: obstacleY, width: obstacleWidth, height: obstacleHeight });
};

const drawObstacles = () => {
    obstacles.forEach(obstacle => {
        ctx.fillStyle = 'white';
        ctx.strokestyle = 'white';
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
};

const increaseSpeed = () => {
    if (gameSpeed > 50) {
        gameSpeed -= 5;
    }
};

const changeDirection = (event) => {
    if (changingDirection) return;
    changingDirection = true;

    const LEFT_KEY = 37;
    const RIGHT_KEY = 39;
    const UP_KEY = 38;
    const DOWN_KEY = 40;

    const keyPressed = event.keyCode;
    const goingUp = dy === -10;
    const goingDown = dy === 10;
    const goingRight = dx === 10;
    const goingLeft = dx === -10;

    if (keyPressed === LEFT_KEY && !goingRight) {
        dx = -10;
        dy = 0;
    }

    if (keyPressed === UP_KEY && !goingDown) {
        dx = 0;
        dy = -10;
    }

    if (keyPressed === RIGHT_KEY && !goingLeft) {
        dx = 10;
        dy = 0;
    }

    if (keyPressed === DOWN_KEY && !goingUp) {
        dx = 0;
        dy = 10;
    }
};

const showRestartButton = () => {
    restartButton.style.display = 'block';
};

const startGame = () => {
    snake = [{ x: 200, y: 200 }];
    dx = 10;
    dy = 0;
    score = 0;
    gameSpeed = 100;
    obstacles = [];
    scoreDisplay.innerHTML = 'Score: ' + score;
    restartButton.style.display = 'none';
    createFood();
    main();
};

document.addEventListener('keydown', changeDirection);

startGame();
