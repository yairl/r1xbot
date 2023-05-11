from pydub import AudioSegment

from src.infra.context import Context

def convert_ogg_to_mp3(ctx:Context, ogg_file_path:str, mp3_file_path:str) -> str:
    try:
        audio = AudioSegment.from_ogg(ogg_file_path)
        audio.export(mp3_file_path, format="mp3")
        ctx.log("convertOggToMp3 succeeded")
        return mp3_file_path
    except Exception as err:
        raise err

