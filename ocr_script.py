from paddleocr import PaddleOCR
import sys
import os

# Initialize PaddleOCR once
# use_angle_cls=True allows detecting rotated text
ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

def run_ocr_batch(image_paths):
    for image_path in image_paths:
        if not os.path.exists(image_path):
            print(f"{image_path}|Error: File not found")
            continue

        try:
            result = ocr.ocr(image_path, cls=True)
            
            # result is a list of lists of predictions
            extracted_text = []
            if result and result[0]:
                for line in result[0]:
                    text = line[1][0]
                    confidence = line[1][1]
                    if confidence > 0.5:
                        extracted_text.append(text)
            
            # Join multiple lines with space
            final_text = " ".join(extracted_text)
            
            # Output format: filename|text
            # We use | as delimiter, assuming filenames don't contain it
            print(f"{image_path}|{final_text}")
            
        except Exception as e:
            print(f"{image_path}|Error: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Pass all arguments except script name
        run_ocr_batch(sys.argv[1:])
    else:
        print("Error: No image paths provided")
