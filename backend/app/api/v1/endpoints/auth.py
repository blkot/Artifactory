from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.crud.user import create_user, get_by_email, get_by_username
from app.db import get_db
from app.models.user import User
from app.models.revoked_token import RevokedToken
from app.schemas.auth import LogoutRequest, RefreshTokenRequest, Token, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register user",
    description="Create a user account for API authentication.",
    responses={400: {"description": "Username/email already exists"}},
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    if get_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    if payload.email and get_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already exists")
    return create_user(db, payload)


@router.post(
    "/login",
    response_model=Token,
    summary="Login",
    description="Authenticate with username/password and return a JWT access token.",
    responses={401: {"description": "Invalid credentials"}},
)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = get_by_username(db, form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    settings = get_settings()
    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    refresh_token = create_refresh_token(
        subject=user.username,
        expires_delta=timedelta(minutes=settings.refresh_token_expire_minutes),
    )
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/refresh",
    response_model=Token,
    summary="Refresh access token",
    description="Exchange a refresh token for a new short-lived access token.",
    responses={401: {"description": "Invalid refresh token"}},
)
def refresh_access_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> Token:
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    subject = decoded.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = get_by_username(db, str(subject))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = decoded.get("jti")
    if jti and db.query(RevokedToken).filter(RevokedToken.token_jti == jti).first():
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    settings = get_settings()
    access_token = create_access_token(
        subject=user.username,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    return Token(access_token=access_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout",
    description="Revoke a refresh token so it can no longer be used.",
    responses={401: {"description": "Invalid refresh token"}},
)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> None:
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = decoded.get("jti")
    if not jti:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    existing = db.query(RevokedToken).filter(RevokedToken.token_jti == jti).first()
    if not existing:
        db.add(RevokedToken(token_jti=jti, reason="logout"))
        db.commit()


@router.get(
    "/me",
    response_model=UserRead,
    summary="Current user",
    description="Get the currently authenticated user from bearer token.",
    responses={401: {"description": "Not authenticated"}},
)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
