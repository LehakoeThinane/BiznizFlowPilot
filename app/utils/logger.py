"""Logging configuration."""

import logging
import sys

from app.core.config import settings

# Create logger
logger = logging.getLogger("biznizflowpilot")
logger.setLevel(getattr(logging, settings.log_level))

# Create console handler
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(getattr(logging, settings.log_level))

# Create formatter
formatter = logging.Formatter(
    "[%(asctime)s] %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
handler.setFormatter(formatter)

# Add handler to logger
logger.addHandler(handler)


def get_logger(name: str = "biznizflowpilot") -> logging.Logger:
    """Get logger instance."""
    return logging.getLogger(name)
