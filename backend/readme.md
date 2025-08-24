┌─────────────┐
│ API Request │
└─────┬───────┘
      │
   ┌──▼──┐    ✅ Success
   │ Try │────────────► Return Result
   └──┬──┘
      │
   ❌ 429 Error
      │
   ┌──▼──────────┐
   │ Check Retry │
   │ Attempts    │
   └──┬──────────┘
      │
   ┌──▼──────┐    ⏳ Wait Period
   │ Wait &  │────────────┐
   │ Backoff │            │
   └─────────┘            │
      ▲                   │
      │                   │
      └───────────────────┘