import os
import hashlib

def delete_duplicates():
    file_hashes = set()
    ignored = ['.git', '.github', '__pycache__', 'node_modules', '.env', 'dist', 'build']
    
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ignored]
        for file in files:
            path = os.path.join(root, file)
            if any(x in path for x in ignored) or file == 'find_duplicates.py':
                continue
            try:
                with open(path, 'rb') as f:
                    f_hash = hashlib.sha256(f.read()).hexdigest()
                if f_hash in file_hashes:
                    print(f"حذف ملف مكرر: {path}")
                    os.remove(path) # حذف فعلي من الشجرة
                else:
                    file_hashes.add(f_hash)
            except Exception as e:
                print(f"خطأ في فحص {path}: {e}")

if __name__ == "__main__":
    delete_duplicates()
    
