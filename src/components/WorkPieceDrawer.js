import React, { useEffect, useRef, useState } from 'react';

const WorkPieceDrawer = ({
    circles,
    width,
    height,
    animationKey,
    work,
    delay = 200,
    blinkSpeed = 100,
    moveSpeed = 200,
    activeTool,
}) => {
    const canvasRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHighlighted, setIsHighlighted] = useState(false);

    const targetCircles = circles.filter((c) => c.tool === activeTool);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const drawMaterialBox = () => {
            //console.log('##### work data in drawMaterialBox:', work);
            //console.log('##### partSizeX:', work?.partSizeX, 'partSizeY:', work?.partSizeY);
            const foundWork = Array.isArray(work)
                ? work.find((workItem) => {
                      // toolName에서 숫자만 추출
                      const match = workItem.toolName.match(/T(\d+)/);
                      const toolNumber = match ? parseInt(match[1], 10) : null;

                      // activeTool과 숫자 비교
                      const isMatch = toolNumber === activeTool;

                      return isMatch;
                  })
                : work;

            if (foundWork && foundWork.partSizeX && foundWork.partSizeY) {
                const { partSizeX, partSizeY } = foundWork;

                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.strokeStyle = 'gray';

                ctx.beginPath();
                ctx.rect(0, 0, partSizeX, partSizeY);
                ctx.stroke();
                ctx.closePath();

                ctx.setLineDash([]);
            }
        };

        const drawCircles = () => {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(0, height);
            ctx.scale(1, -1);

            drawMaterialBox();

            circles.forEach(({ x, y, r, color }) => {
                ctx.beginPath();
                ctx.arc(x, y, r, 0, 2 * Math.PI);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();
            });
        };

        const highlightCurrentCircle = () => {
            if (!targetCircles[currentIndex] || !isHighlighted) return;

            const { x, y } = targetCircles[currentIndex];

            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.closePath();

            ctx.beginPath();
            ctx.moveTo(x - 12, y);
            ctx.lineTo(x + 12, y);
            ctx.moveTo(x, y - 12);
            ctx.lineTo(x, y + 12);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.closePath();
        };

        const render = () => {
            drawCircles();
            highlightCurrentCircle();
        };

        render();
    }, [circles, currentIndex, isHighlighted, height, work, activeTool]);

    useEffect(() => {
        setCurrentIndex(0);
        setIsHighlighted(false);

        let highlightInterval;
        let indexInterval;

        const delayTimeout = setTimeout(() => {
            setIsHighlighted(true);

            highlightInterval = setInterval(() => {
                setIsHighlighted((prev) => !prev);
            }, blinkSpeed);

            indexInterval = setInterval(() => {
                setCurrentIndex((prevIndex) => {
                    const nextIndex = prevIndex + 1;
                    if (nextIndex < targetCircles.length) {
                        return nextIndex;
                    } else {
                        clearInterval(highlightInterval);
                        clearInterval(indexInterval);
                        return 0; // 하이라이트 원을 첫 번째 위치로 되돌림
                    }
                });
            }, moveSpeed);
        }, delay);

        return () => {
            clearTimeout(delayTimeout);
            clearInterval(highlightInterval);
            clearInterval(indexInterval);
        };
    }, [circles, animationKey, delay, activeTool]);

    return <canvas ref={canvasRef} width={width} height={height} style={{ border: '1px solid black' }} />;
};

export default WorkPieceDrawer;
