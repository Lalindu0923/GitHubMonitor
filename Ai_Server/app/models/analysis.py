from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CommitMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    message: str = ""
    author: str | None = None
    url: str | None = None


class FileChange(BaseModel):
    model_config = ConfigDict(extra="allow")

    filename: str | None = None
    additions: int = 0
    deletions: int = 0
    changes: int = 0
    patch: str | None = None


class CommitAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    commit: CommitMetadata = Field(default_factory=CommitMetadata)
    files: list[FileChange] = Field(default_factory=list)


class CommitAnalysisResponse(BaseModel):
    score: int
    result: str
    files_changed: int
    additions: int
    deletions: int
    ai_review: str
    prompt: str | None = None
    provider: str | None = None
    model: str | None = None
    raw_llm_output: dict[str, Any] | None = None