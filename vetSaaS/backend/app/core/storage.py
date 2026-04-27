import boto3
from botocore.config import Config

from app.core.config import settings

_client = None


def get_r2_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url
            or f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    return _client


def upload_file(file_bytes: bytes, key: str, content_type: str) -> str:
    """Upload bytes to R2 and return the public URL."""
    client = get_r2_client()
    client.put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return f"https://{settings.r2_account_id}.r2.cloudflarestorage.com/{settings.r2_bucket_name}/{key}"


def delete_file(key: str) -> None:
    client = get_r2_client()
    client.delete_object(Bucket=settings.r2_bucket_name, Key=key)


def clinic_logo_key(clinic_id: str) -> str:
    return f"clinics/{clinic_id}/logo/logo.png"


def medical_record_attachment_key(clinic_id: str, patient_id: str, filename: str) -> str:
    return f"clinics/{clinic_id}/medical_records/{patient_id}/{filename}"


def vaccination_card_key(clinic_id: str, patient_id: str, vaccination_id: str) -> str:
    return f"clinics/{clinic_id}/vaccination_cards/{patient_id}_{vaccination_id}.pdf"


def report_key(clinic_id: str, report_id: str) -> str:
    return f"clinics/{clinic_id}/reports/{report_id}.pdf"
