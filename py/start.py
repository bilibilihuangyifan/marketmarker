import sys
import os
import time
mod = sys.argv[1]
while True :
	localtime = time.asctime(time.localtime(time.time()))
	print (localtime)
	os.system('node maketmaker.py '+mod)
	print ('start python 5s later')
	time.sleep(5)
