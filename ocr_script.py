from paddleocr import PaddleOCR
import sys
import os

# Initialize PaddleOCR
# use_angle_cls=True allows detecting rotated text
# lang='en' for English
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

def run_ocr(image_path):
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} does not exist")
        return

    try:
        result = ocr.ocr(image_path, cls=True)
        
        # result is a list of lists of predictions
        # structure: [[[[x1,y1], [x2,y2], ...], ("text", confidence)], ...]
        
        extracted_text = []
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                confidence = line[1][1]
                # Filter low confidence if needed
                if confidence > 0.5:
                    extracted_text.append(text)
        
        # Print just the text to stdout for the Node.js process to capture
        # If multiple lines, join them with space
        print(" ".join(extracted_text))
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        run_ocr(image_path)
    else:
        print("Error: No image path provided")
