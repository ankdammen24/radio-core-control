# Radio Platform Architecture

## Projektöversikt

Plattformen består av tre separata men sammankopplade projekt:

1. **Radio Core**
   - Backend och kontrollplan
   - Hanterar media, metadata, streaming, AI, storage, automation och API

2. **Listen**
   - Publik ljudspelare
   - Körs på `listen.radiouppsala.se`
   - Hanterar live, on-demand, spellistor, favoriter och lyssnarupplevelse

3. **Radio Uppsala**
   - Publik mediesajt
   - Körs på `radiouppsala.se`
   - Hanterar nyheter, artiklar, programinfo, events och marknadsföring

---

## Grundprincip

Radio Core är systemets källa till sanning.

```txt
Radio Core äger:
- ljudfiler
- metadata
- stationer
- användare
- rättigheter
- AI-jobb
- storage
- streaming
- analytics
