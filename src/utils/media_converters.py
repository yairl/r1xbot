from pydub import AudioSegment

from infra.context import Context

def convert_audio_to_mp3(ctx:Context, orig_file_path:str, mp3_file_path:str) -> str:
    try:
        audio = AudioSegment.from_file(orig_file_path)
        audio.export(mp3_file_path, format="mp3")
        ctx.log("convertAudioToMp3 succeeded")
        return mp3_file_path
    except Exception as err:
        raise err

