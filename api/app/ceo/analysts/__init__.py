"""Analyst modules — importing this package registers every analyst.

Adding analyst #N = drop a new module here that subclasses Analyst. Nothing
else changes (registry auto-registration + this auto-import).
"""

import importlib
import pkgutil

for _mod in pkgutil.iter_modules(__path__):
    importlib.import_module(f"{__name__}.{_mod.name}")
