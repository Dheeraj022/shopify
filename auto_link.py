import pty
import os
import sys
import time
import select

def strip_ansi(text):
    import re
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def run():
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("npx", ["npx", "--yes", "@shopify/cli@latest", "app", "config", "link"])
    else:
        output = ""
        while True:
            r, _, _ = select.select([fd], [], [], 2)
            if fd in r:
                try:
                    data = os.read(fd, 1024)
                    if not data:
                        break
                    decoded = data.decode(errors='ignore')
                    output += decoded
                    sys.stdout.write(decoded)
                    sys.stdout.flush()
                except OSError:
                    break
            else:
                clean_output = strip_ansi(output).replace('\n', '').replace(' ', '')
                if 'Whichorganization' in clean_output:
                    os.write(fd, b"\r")
                    output = ""
                elif 'Whichexistingapp' in clean_output:
                    os.write(fd, b"Return Manager\r")
                    output = ""
                elif 'Doyouwant' in clean_output:
                    # just in case it asks Do you want to create a new app or link...
                    os.write(fd, b"\x1b[B\r") # down arrow, enter
                    output = ""

run()
