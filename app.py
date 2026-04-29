import os
import json
import time
import base64
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ─────────────────────────────────────────────────────────
# FUNCTION A: Vision LLM — Image → Product Data
# Currently uses Gemini. Replace api_key with env var in prod.
# ─────────────────────────────────────────────────────────
def extract_product_data(image_path: str) -> dict:
    """
    Sends the product image to Gemini Vision and returns structured JSON.

    Returns dict with keys:
        brand_name, manufacturer, active_ingredients (list of {name, concentration}),
        form_factor, route, quantity, confidence
    """
    api_key = os.environ.get("GEMINI_API_KEY", "AIzaSyBlqBbsR02Cw9fp8Z-RfFbJ_ej6UwcBdQc")

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        with open(image_path, "rb") as f:
            image_bytes = f.read()

        mime_type = "image/jpeg"
        ext = image_path.rsplit('.', 1)[-1].lower()
        if ext == "png":
            mime_type = "image/png"
        elif ext == "webp":
            mime_type = "image/webp"

        prompt = """You are a pharmaceutical data extractor. Analyze this product image.
Return ONLY a raw JSON object — no markdown, no prose, no explanation.

JSON schema (all fields required):
{
  "brand_name": "string",
  "manufacturer": "string or null",
  "active_ingredients": [{"name": "string", "concentration": "string"}],
  "form_factor": "string (Tablet/Capsule/Cream/Gel/Serum/Lotion/Facewash)",
  "route": "string (Oral/Topical/Injectable)",
  "quantity": "string or null",
  "confidence": float between 0.0 and 1.0
}

If you cannot read the label clearly, set confidence < 0.7 but still return your best guess."""

        response = model.generate_content([
            prompt,
            {"mime_type": mime_type, "data": image_bytes}
        ])

        raw = response.text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)

    except Exception as e:
        # Fallback: return a low-confidence placeholder so the frontend shows an error
        print(f"[extract_product_data] Error: {e}")
        return {
            "brand_name": "Unknown",
            "manufacturer": None,
            "active_ingredients": [{"name": "Unknown", "concentration": "Unknown"}],
            "form_factor": "Unknown",
            "route": "Unknown",
            "quantity": None,
            "confidence": 0.0
        }


# ─────────────────────────────────────────────────────────
# FUNCTION B: Gemini Text — Generic Alternatives Search
# Uses the same Gemini key; can swap to Perplexity later.
# ─────────────────────────────────────────────────────────
def search_generic_alternatives(product_data: dict) -> dict:
    """
    Asks Gemini to find generic equivalents and the original product's real price.

    Returns the full JSON object matching the frontend schema:
    {
      "original": { brand_name, manufacturer, active_ingredients, route, form_factor,
                    quantity, estimated_price_inr, why_expensive },
      "alternatives": [ { rank, platform, product_name, manufacturer, active_ingredients,
                          form_factor, quantity, price_inr, price_per_unit_inr, unit_label,
                          savings_pct, savings_vs_original, bioequivalent,
                          prescription_required, url } ]
    }
    """
    api_key = os.environ.get("GEMINI_API_KEY", "AIzaSyBlqBbsR02Cw9fp8Z-RfFbJ_ej6UwcBdQc")

    ingredients = ", ".join(
        f"{i['name']} {i['concentration']}"
        for i in product_data.get("active_ingredients", [])
    )
    brand = product_data.get("brand_name", "Unknown")
    form = product_data.get("form_factor", "")
    route = product_data.get("route", "")
    qty = product_data.get("quantity", "")
    mfr = product_data.get("manufacturer", "")

    prompt = f"""You are a clinical pharmacology assistant helping Indian patients find affordable generic equivalents.

Original product:
- Brand name: {brand}
- Manufacturer: {mfr}
- Active ingredient(s): {ingredients}
- Form: {form}
- Route: {route}
- Quantity: {qty}

TASK:
1. Identify the real retail price (MSRP) of the original branded product in India (INR).
2. Find up to 3 cheaper generic equivalents available in India with the SAME active ingredient(s) and concentration.
3. Assign each generic to the BEST matching Indian e-pharmacy: 1mg, PharmEasy, Apollo Pharmacy, or Netmeds.
4. Calculate savings_pct and savings_vs_original relative to the original estimated_price_inr.

IMPORTANT: Use real Indian brand names. All prices in INR. Be medically accurate.

Return ONLY valid JSON — no markdown, no explanation:
{{
  "original": {{
    "brand_name": "{brand}",
    "manufacturer": "{mfr}",
    "active_ingredients": [{{"name": "INN Name", "concentration": "0.1%"}}],
    "route": "{route}",
    "form_factor": "{form}",
    "quantity": "{qty}",
    "estimated_price_inr": <real number>,
    "why_expensive": "One-line reason (brand premium, import duty, etc.)"
  }},
  "alternatives": [
    {{
      "rank": 1,
      "platform": "1mg",
      "product_name": "Generic Brand Name",
      "manufacturer": "Manufacturer Name",
      "active_ingredients": [{{"name": "INN Name", "concentration": "0.1%"}}],
      "form_factor": "{form}",
      "quantity": "{qty}",
      "price_inr": <number>,
      "price_per_unit_inr": <number>,
      "unit_label": "per gram",
      "savings_pct": <integer 0-99>,
      "savings_vs_original": <number>,
      "bioequivalent": true,
      "prescription_required": false,
      "url": "https://www.1mg.com/search/all?name=GenericName"
    }}
  ]
}}"""

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.1}
        )

        raw = response.text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)

    except Exception as e:
        print(f"[search_generic_alternatives] Error: {e}")
        raise ValueError(f"Gemini alternative search failed: {e}")


# ─────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Accepts a multipart/form-data POST with an 'image' field.
    Returns the full JSON object consumed by script.js renderOutput().
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files['image']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Use PNG, JPG, JPEG, or WEBP."}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        # Step 1: Vision — identify the product
        product_data = extract_product_data(filepath)

        if product_data.get("confidence", 1.0) < 0.7:
            return jsonify({
                "error": "low_confidence",
                "message": "Image quality too low to extract product details reliably.",
                "confidence": product_data.get("confidence"),
                "partial_data": product_data
            }), 422

        # Step 2: Find generic alternatives (returns full schema)
        result = search_generic_alternatives(product_data)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/static/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
