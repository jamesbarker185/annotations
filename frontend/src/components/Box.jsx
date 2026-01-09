import React from 'react';
import { Rnd } from 'react-rnd';

const Box = ({
    box,
    isSelected,
    onSelect,
    onChange,
    scale
}) => {
    const { x, y, width, height } = box.value;

    // Rnd works better with pixels usually, but supports %.
    // However, dragging in % can be tricky if parent size changes. 
    // Ideally we pass parent dimensions or work in %.
    // react-rnd supports `default={{ x: ..., y: ..., width: ..., height: ... }}`
    // But for controlled component we use `size` and `position`.
    // Since our data is %, we need to know the parent size in pixels to drive Rnd smoothly, OR let Rnd handle px and we convert back to % on stop.
    // The User Plan says "Edit text, Delete text", "Edit existing box".

    // We'll use % for storage, convert to % on save.
    // But Rnd needs pixel values or % strings.

    return (
        <Rnd
            bounds="parent"
            size={{ width: `${width}%`, height: `${height}%` }}
            position={{ x: x * (scale.width / 100), y: y * (scale.height / 100) }}
            onDragStop={(e, d) => {
                const newX = (d.x / scale.width) * 100;
                const newY = (d.y / scale.height) * 100;
                onChange({ ...box, value: { ...box.value, x: newX, y: newY } });
            }}
            onResizeStop={(e, direction, ref, delta, position) => {
                // We use offsetWidth/Height to get the actual pixel size after resize
                // because ref.style.width might be a % string which parseFloat handles poorly in this context
                const newWidth = (ref.offsetWidth / scale.width) * 100;
                const newHeight = (ref.offsetHeight / scale.height) * 100;

                // Rnd returns position in px
                const newX = (position.x / scale.width) * 100;
                const newY = (position.y / scale.height) * 100;

                onChange({
                    ...box,
                    value: {
                        ...box.value,
                        width: newWidth,
                        height: newHeight,
                        x: newX,
                        y: newY
                    }
                });
            }}
            // Use Rnd's position/size props if we want controlled, but tracking drag is better done by letting Rnd manage internal state during drag and updating on stop?
            // Actually strictly controlled is better for undo/redo if we added it, but let's stick to update-on-stop.
            // Wait, passing `position` and `size` makes it strictly controlled.
            disableDragging={!isSelected}
            enableResizing={isSelected ? undefined : false}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
            style={{
                border: isSelected ? '2px solid #00d2ff' : '2px solid rgba(0, 210, 255, 0.5)',
                backgroundColor: isSelected ? 'rgba(0, 210, 255, 0.1)' : 'transparent',
                cursor: isSelected ? 'move' : 'pointer',
                zIndex: isSelected ? 10 : 1
            }}
        >
            {box.value.text && (
                <div style={{
                    position: 'absolute',
                    top: -24,
                    left: -2,
                    background: isSelected ? '#00d2ff' : 'rgba(0, 210, 255, 0.5)',
                    color: 'black',
                    padding: '2px 6px',
                    fontSize: 12,
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    fontWeight: 600
                }}>
                    {box.value.text}
                </div>
            )}
        </Rnd>
    );
};

export default Box;
