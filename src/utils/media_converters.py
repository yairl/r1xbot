from pydub import AudioSegment

def convert_ogg_to_mp3(ctx, ogg_file_path, mp3_file_path):
    try:
        audio = AudioSegment.from_ogg(ogg_file_path)
        audio.export(mp3_file_path, format="mp3")
        ctx.log("convertOggToMp3 succeeded")
        return mp3_file_path
    except Exception as err:
        raise err

