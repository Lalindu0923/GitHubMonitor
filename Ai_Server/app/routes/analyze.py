from fastapi import APIRouter

from app.models.analysis import CommitAnalysisRequest
from app.services.analysis_service import analyze_commit_logic

router = APIRouter()


@router.post("/analyze")
def analyze_commit(commit: CommitAnalysisRequest):

    result = analyze_commit_logic(commit.model_dump())

    return result