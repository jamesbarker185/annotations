import React, { useState, useRef, useEffect } from 'react';
import Box from './Box';

const Canvas = ({
    imageSrc,
    annotations,
    selectedBoxId,
    onBoxSelect,
    onBoxChange,
    onAddBox
}) => {
    const containerRef = useRef(null);
    const [scale, setScale] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const updateScale = () => {
            const { offsetWidth, offsetHeight } = containerRef.current;
            setScale({ width: offsetWidth, height: offsetHeight });
        };

        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [imageSrc]); // Re-measure when image changes (or loads)

    const handleImageLoad = (e) => {
        setScale({ width: e.target.offsetWidth, height: e.target.offsetHeight });
    };

    const startNewBox = (e) => {
        // Just adding a default box at click position for simplicity
        // Implementing drag-to-create is a bit more complex with Rnd overlaying.
        if (e.target !== containerRef.current && e.target.tagName !== 'IMG') return;

        const rect = containerRef.current.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;

        onAddBox({
            x: xPct,
            y: yPct,
            width: 10,
            height: 10
        });
    };

    return (
        <div
            ref={containerRef}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                backgroundColor: '#111',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}
            onClick={startNewBox}
        >
            {imageSrc && (
                <img
                    src={imageSrc}
                    alt="Task"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        userSelect: 'none'
                    }}
                    onLoad={handleImageLoad}
                />
            )}

            {/* We need an absolute overlay that matches the image dimensions exactly 
          so that % based coordinates match the image, not the container (if object-fit leaves gaps)
          BUT, getting the exact rendered image rect is tricky with object-fit: contain.
          
          Easier approach: Make the container display block and let image dictate size? 
          Or simpler: Overlay assumes the image fills the container.
          
          Let's try to wrap the image in a div that shrinks to fit content? 
          No, easier is to just use the image's bounding client rect for the overlay.
      */}

            <div
                style={{
                    position: 'absolute',
                    // We need to match the image explicitly.
                    // This is tricky. Let's rely on standard layout:
                    // If the image is centered, we can compute offsets?
                    // Or just make the annotations children of a div that wraps the image exactly.
                    // Let's refactor:
                    top: 0, left: 0, width: '100%', height: '100%',
                    pointerEvents: 'none' // Let clicks pass to image unless on box
                }}
            >
                {/* Actually, to support correct % coordinates relative to IMAGE, 
            we really need the container to exactly match the image size.
            
            Let's assume the image is loaded. We can query the image element. 
        */}
            </div>

        </div>
    );
};

// Refined Version:
// We render the image. We put a div ON TOP of the image with same dimensions.
const CanvasWrapper = ({ imageSrc, annotations, selectedBoxId, onBoxSelect, onBoxChange, onAddBox }) => {
    const imgRef = useRef(null);
    const [dims, setDims] = useState(null);

    const onImgLoad = (e) => {
        setDims({ w: e.target.clientWidth, h: e.target.clientHeight });
    };

    // Update dims on resize
    useEffect(() => {
        const handleResize = () => {
            if (imgRef.current) {
                setDims({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleCreate = (e) => {
        if (!dims) return;
        // Create relative to this container
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / dims.w) * 100;
        const y = ((e.clientY - rect.top) / dims.h) * 100;
        onAddBox({ x, y, width: 10, height: 5 });
    };

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: '#0a0a0a',
            overflow: 'hidden',
            padding: 20
        }}>
            <div style={{ position: 'relative' }}>
                <img
                    ref={imgRef}
                    src={imageSrc}
                    onLoad={onImgLoad}
                    style={{
                        display: 'block',
                        maxHeight: '90vh',
                        maxWidth: '100%',
                        objectFit: 'contain'
                    }}
                    draggable={false}
                />
                {dims && (
                    <div
                        onClick={(e) => {
                            if (e.target === e.currentTarget) handleCreate(e);
                        }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: dims.w,
                            height: dims.h,
                            // border: '1px solid red' // debug
                        }}
                    >
                        {annotations.map((ann, i) => (
                            <Box
                                key={i}
                                box={ann}
                                scale={{ width: dims.w, height: dims.h }}
                                isSelected={i === selectedBoxId}
                                onSelect={() => onBoxSelect(i)}
                                onChange={(newBox) => onBoxChange(i, newBox)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CanvasWrapper;
