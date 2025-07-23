import os
import glob
import json
import csv
import uuid
from typing import Dict, Any, List, Optional
from fastapi import FastAPI
from pydantic import BaseModel
import frontmatter
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from dotenv import load_dotenv

# ───────────────────────────────────────────────────────────────
#  CONFIGURATION & KB LOADING
# ───────────────────────────────────────────────────────────────
KB_ROOT      = "kb_docs"
FEATURE_LOG  = "data/feature_requests.csv"
SALES_LOG    = "data/sales_leads.csv"
SUPPORT_LOG  = "data/support_contacts.csv"
TS_THRESHOLD = 0.7  # Threshold for the first KB lookup pass
ALT_THRESHOLD = 0.4 # Threshold for alternative KB suggestions

# load .env
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_KEY:
    raise RuntimeError("OPENAI_API_KEY missing in environment")

# init OpenAI
client = OpenAI(api_key=OPENAI_KEY)

# build in‐memory KB
entries: List[Dict[str,Any]] = []
for md in glob.glob(f"{KB_ROOT}/*/*.md"):
    post = frontmatter.load(md)
    meta = post.metadata
    text = f"{meta['question']}\n\n{post.content.strip()}"
    entries.append({"text": text})
model = SentenceTransformer("all-MiniLM-L6-v2")
texts = [e["text"] for e in entries]
embs  = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
embs  = embs / np.linalg.norm(embs, axis=1, keepdims=True)
index = faiss.IndexFlatIP(embs.shape[1]); index.add(embs)

def query_kb(q:str, top_k:int=3):
    qe = model.encode([q], convert_to_numpy=True)
    qe = qe/np.linalg.norm(qe)
    D,I = index.search(qe, top_k)
    return [(entries[i]["text"], float(D[0][j])) for j,i in enumerate(I[0])]

# ───────────────────────────────────────────────────────────────
#  STATE MACHINES
# ───────────────────────────────────────────────────────────────
LABELS = [
    "greeting","farewell","gratitude",
    "technical_support","feature_request",
    "sales_lead","unknown"
]

def analyze_message(msg:str) -> Dict[str,Any]:
    system = (
        "You are a customer-support assistant. "
        "Return JSON with keys:\n"
        "  intent in " + str(LABELS) + "\n"
        "  sentiment in {positive,neutral,negative}\n"
        "  escalate in {true,false}\n"
    )
    user = f"Message: \"{msg}\""
    resp = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role":"system","content":system},
            {"role":"user",  "content":user}
        ],
        temperature=0.0
    )
    return json.loads(resp.choices[0].message.content)

# per‐session store
sessions: Dict[str,Dict[str,Any]] = {}

# ───────────────────────────────────────────────────────────────
#  API MODELS & APP
# ───────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message:      str
    reset:        bool = False
    session_id:   Optional[str] = None

class ChatResponse(BaseModel):
    reply:        str
    endSession:   bool
    session_id:   str

app = FastAPI()

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    msg, reset, sid = req.message, req.reset, req.session_id

    # 1. SESSION MANAGEMENT
    if reset or not sid or sid not in sessions:
        sid = str(uuid.uuid4())
        sessions[sid] = {"stage": "initial", "data": {}}
    state = sessions[sid]
    stage = state["stage"]

    # 2. STAGE-BASED LOGIC (Follow-up Questions)
    # This block handles replies within an ongoing conversation flow.
    # It runs BEFORE the intent classification for new messages.
    
    # Technical Support Flow
    if stage == "awaiting_ts_confirm":
        # User confirms the solution worked
        if msg.strip().lower().startswith("y"):
            sessions.pop(sid, None)
            return ChatResponse(reply="Great! Glad I could help.", endSession=True, session_id=sid)
        
        # User says "no", try Pass 2 (alternative suggestions)
        alts = state["data"].get("alternatives", [])
        if alts:
            suggestions = "\n".join(f"- {text}" for text, score in alts)
            state["data"]["alternatives"] = [] # Clear alternatives so we don't offer them again
            state["stage"] = "awaiting_ts_confirm" # Await confirmation on new suggestions
            return ChatResponse(
                reply=f"Okay. How about one of these instead?\n{suggestions}\n\nDoes any of these help? (yes/no)",
                endSession=False, session_id=sid
            )
        
        # No more suggestions, fallback to collecting contact info
        state["stage"] = "awaiting_contact"
        return ChatResponse(
            reply="I couldn't find an immediate answer...Could you share your phone or email so our team can follow up?",
            endSession=False, session_id=sid
        )

    if stage == "awaiting_contact":
        # Log the original query and the contact info provided by the user
        os.makedirs(os.path.dirname(SUPPORT_LOG), exist_ok=True)
        with open(SUPPORT_LOG, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow([state["data"]["last_q"], msg])
        sessions.pop(sid, None)
        return ChatResponse(reply="Thank you--we'll reach out as soon as possible.", endSession=True, session_id=sid)

    # Feature Request Flow
    if stage == "awaiting_feature_email":
        # Now we have both the feature text and the email, write the complete record
        feature_text = state["data"]["feature_text"]
        email = msg
        os.makedirs(os.path.dirname(FEATURE_LOG), exist_ok=True)
        with open(FEATURE_LOG, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow([feature_text, email])
        sessions.pop(sid, None)
        return ChatResponse(reply="Thank you! You'll be among the first to know when we roll this out.", endSession=True, session_id=sid)

    # Sales Lead Flow
    if stage == "awaiting_company":
        state["data"]["company"] = msg
        state["stage"] = "awaiting_phone"
        return ChatResponse(reply="Great--what's your phone number?", endSession=False, session_id=sid)
    
    if stage == "awaiting_phone":
        state["data"]["phone"] = msg
        state["stage"] = "awaiting_email"
        return ChatResponse(reply="And your email address?", endSession=False, session_id=sid)
        
    if stage == "awaiting_email":
        state["data"]["email"] = msg
        sd = state["data"]
        os.makedirs(os.path.dirname(SALES_LOG), exist_ok=True)
        with open(SALES_LOG, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow([sd["sales_query"], sd["company"], sd["phone"], sd["email"]])
        sessions.pop(sid, None)
        return ChatResponse(reply="Thanks -- our sales team will be in touch soon.", endSession=True, session_id=sid)


    # 3. INITIAL MESSAGE HANDLING (Intent Classification)
    # This block runs only for the first message in a conversation or when stage is "initial".
    info = analyze_message(msg)
    intent = info["intent"]
    escalate = info["escalate"]

    # Simple, single-reply intents
    if intent == "greeting":
        return ChatResponse(reply="Hi, how may I be of any help today?", endSession=False, session_id=sid)
    if intent == "farewell":
        sessions.pop(sid, None)
        return ChatResponse(reply="I hope I was of some help. Goodbye!", endSession=True, session_id=sid)
    if intent == "gratitude":
        sessions.pop(sid, None)
        return ChatResponse(reply="You're welcome! I hope I helped.", endSession=True, session_id=sid)

    # Technical Support & Unknown Intent
    if intent in ("technical_support", "unknown"):
        if escalate:
            sessions.pop(sid, None)
            return ChatResponse(reply="I'm really sorry you're frustrated...connecting you to a human agent now.", endSession=True, session_id=sid)
        
        # KB lookup pass 1
        results = query_kb(msg, top_k=3)
        top_text, top_score = results[0]
        state["data"]["last_q"] = msg
        
        if top_score >= TS_THRESHOLD:
            state["stage"] = "awaiting_ts_confirm"
            state["data"]["alternatives"] = [(t,s) for t,s in results[1:] if s >= ALT_THRESHOLD]
            return ChatResponse(
                reply=f"{top_text}\n\nDoes this resolve your issue? (yes/no)",
                endSession=False, session_id=sid
            )
        else:
            state["stage"] = "awaiting_contact"
            return ChatResponse(
                reply="I couldn't find an immediate answer...Could you share your phone or email so our team can follow up?",
                endSession=False, session_id=sid
            )

    # Feature Request
    if intent == "feature_request":
        # Store the feature text in session data and ask for email
        state["data"]["feature_text"] = msg
        state["stage"] = "awaiting_feature_email"
        return ChatResponse(
            reply=f"We've logged your request for: \"{msg}\"\nCould you share your email so we can notify you when it's live?",
            endSession=False, session_id=sid
        )

    # Sales Lead
    if intent == "sales_lead":
        state["data"]["sales_query"] = msg
        state["stage"] = "awaiting_company"
        return ChatResponse(
            reply="Thanks for your interest! Could you share your company name?",
            endSession=False, session_id=sid
        )

    # Catch-all for any unhandled intents
    sessions.pop(sid, None)
    return ChatResponse(reply="I'm sorry, I didn't quite understand that. Could you please rephrase?", endSession=True, session_id=sid)