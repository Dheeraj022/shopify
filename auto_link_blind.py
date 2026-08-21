import pty
import os
import sys
import time

pid, fd = pty.fork()
if pid == 0:
    os.execvp("npx", ["npx", "--yes", "@shopify/cli@latest", "app", "config", "link"])
else:
    # Read in background thread so we don't block
    import threading
    def read_output():
        while True:
            try:
                data = os.read(fd, 1024)
                if not data: break
                sys.stdout.write(data.decode(errors='ignore'))
                sys.stdout.flush()
            except OSError:
                break
    t = threading.Thread(target=read_output)
    t.daemon = True
    t.start()
    
    time.sleep(5)
    os.write(fd, b"\r") # select org
    time.sleep(4)
    os.write(fd, b"Return Manager\r") # enter name and enter
    time.sleep(2)
    os.write(fd, b"\r") # just in case
    
    t.join(30)
