# example JSON from webhook
AUDIO_WEBHOOK_AWS = {"source": "wa", "event": {"event_type": "message_received", "instanceId": "41580", "id": "", "referenceId": "", "data": {"id": "false_972544563082@c.us_CBC005F83A37B9D8C28581C9A23280E6", "from": "972544563082@c.us", "to": "12097300001@c.us", "author": "", "pushname": "\ud83d\udc68\ud83c\udfff\u200d\ud83d\ude92Igor", "ack": "", "type": "ptt", "body": "", "media": "https://s3.eu-central-1.amazonaws.com/ultramsgmedia/2023/4/41580/314dd9965284df4ffaaa6713924b92b4", "fromMe": False, "self": False, "isForwarded": False, "isMentioned": False, "quotedMsg": {}, "mentionedIds": [], "time": 1680604681}}}

# extract media url
media_url = AUDIO_WEBHOOK_AWS['event']['data']['media']

# download media stream
import requests
media_stream = requests.get(media_url)

# prepare audio file name vars
temp_media_file_name_base = '/tmp/aws_media'
unique_string = media_url.split('/')[-1]  # use the string at the end of webhook media
temp_media_file_name = temp_media_file_name_base + '_' + unique_string
temp_media_file_name_in = temp_media_file_name + '.ogg'
temp_media_file_name_out = temp_media_file_name + '.mp3'

# store OGG media to file
with open(temp_media_file_name_in, 'wb') as f:
    f.write(media_stream.content)

# transcode OGG to MP3. This assumes ffmpeg is installed and in path
from pydub import AudioSegment
audio = AudioSegment.from_file(temp_media_file_name_in, format="ogg")
audio.export(temp_media_file_name_out, format="mp3")

# transcribe speech-to-text
import openai
import json
import os
openai.api_key = os.getenv('OPENAI_KEY')
audio_file = open(temp_media_file_name_out, "rb")
transcription = openai.Audio.transcribe("whisper-1", audio_file)

# example output
print(transcription)
