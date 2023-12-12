---
title: Video Processing in the Cloud (Docker Bash S3)
date: 2021/10/06
---


This project performs video processing in the cloud. Using containers, bash script, and S3 storage buckets.

The use case is a website that combines user chat messages with livestreams. This allows you to see what users wrote at different sections of the video stream.  

[Link to GitHub repo](https://github.com/Jesper-Hustad/vod-download-container/tree/main)

It may be obvious that using only bash to process network requests isn't quite intended. So some trickery with network requests are required.

Bash server:  
```bash
PORT="${PORT:-8080}"
echo "Listening on ${PORT}..."
while true; do nc -lk -p "${PORT}" -e "./date.sh" ; done
```



Bash command for processing the video:
```bash
#!/usr/bin/env bash

set -eEuo pipefail

HEAD="$(cat <<EOF
HTTP/1.1 200 OK
Connection: keep-alive
Access-Control-Allow-Origin: https://vodchatdownload.com/\r\n\r\n
EOF
)"

echo -en "$HEAD"

# parse input arguments
read line
declare -a array=($(echo $line | cut -d' ' -f2 | tr "/" " "))

# exit if there are not 3 arguments
[ ${#array[@]} -ne 3 ] && exit 1

vodid="${array[0]}"
start="${array[1]}"
end="${array[2]}"
S3_LOCATION="vod-downloader-tmp-storage@eu-north-1"
ffmpeg_loc='/opt/bin/ffmpeg'
cli_loc="./TwitchDownloaderCLI"

echo "Downloading ${vodid}  from ${start} to ${end}"

mkdir -p "./${vodid}"
tmp_loc="./${vodid}/"

$cli_loc -m VideoDownload --id $vodid -b $start -e $end -q "720p30" -o "${tmp_loc}${vodid}.mp4"
$cli_loc -m ChatDownload --id $vodid -b $start -e $end -o "${tmp_loc}${vodid}_chat.json"
$cli_loc -m ChatRender -i "${tmp_loc}${vodid}_chat.json" -h 520 -w 400 --framerate 30 --update-rate 0 --font-size 15 -o "${tmp_loc}${vodid}_chat.mp4"
ffmpeg -i "${tmp_loc}${vodid}.mp4" -vf "movie=${tmp_loc}${vodid}_chat.mp4 [a]; [a] format=rgba,colorchannelmixer=aa=0.75 [chat];[in][chat] overlay=main_w-overlay_w:0" -vcodec libx264 -r 30 -preset ultrafast "${tmp_loc}${vodid}_export.mp4"

./s3upload.sh $AWS_ACCESS_KEY $AWS_SECRET_KEY $S3_LOCATION "./${vodid}/${vodid}_export.mp4" "${vodid}.mp4"

# remvoes tmp files
rm -rf "/${vodid}"
```


It sounds crazy. But this site has worked flawlessly without any maintenance required. So I just don't touch it.

## Happy customers?

The use case for this project is quite small. But it seems for those who use the website they appreciate the service.

**Email from user:**

>I've been an avid user of your website, which provides 15-minute Twitch VODs with chat, and I greatly appreciate the service you offer to the community.   
I understand that providing extended VODs may come with additional costs, and I am more than willing to compensate for this. Please let me know what options or pricing plans are available for extending the VOD duration to accommodate my needs.  ...
Best regards,


## Conclusions

Good experience with cloud services.  

I am in no way a Bash expert, so it was fun learning all the intricacies. Still, hunting down a weird bug or learning new bash commands with no prior experience is painful. Would be a lot easier today with the help of ChatGPT (for example i use ChatGPT for ffmpeg commands all the time). 

Since i knew there would not be a lot of users it was important that the cloud services did not cost anything if nobody was using them. The docker container is set to auto-shutdown after inactivity and the S3 bucket only stores files for 24 hours.


