import base64
import os

file_path = 'image_8.png'
if os.path.exists(file_path):
    with open(file_path, 'rb') as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
        print(f'data:image/png;base64,{encoded_string}')
else:
    print('File not found')
