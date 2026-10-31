import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Mail, Upload, Shield, Truck, FileText, X, RefreshCw } from 'lucide-react';

export default function ForwarderQuote() {
  const [transportType, setTransportType] = useState('aereo');
  const [seaType, setSeaType] = useState('LCL');
  
  // Carga
  const [cargoLines, setCargoLines] = useState([
    { id: 1, type: 'GRAL', qty: 1, length: 100, width: 100, height: 100, weight: 100 }
  ]);
  const [cwManual, setCwManual] = useState('');
  
  // Módulos Opcionales
  const [showInland, setShowInland] = useState(false);
  const [showInsurance, setShowInsurance] = useState(false);

  // Costos
  const [originCosts, setOriginCosts] = useState([]);
  const [freightCosts, setFreightCosts] = useState([{ id: 1, name: 'Flete Internacional', net: 0, sell: 0, byCw: true }]);
  const [localCosts, setLocalCosts] = useState([]);
  const [inlandCosts, setInlandCosts] = useState([]);
  
  // Seguro
  const [insurance, setInsurance] = useState({
    merchValue: 0,
    currency: 'USD',
    netRate: 0.15,
    sellRate: 0.50,
    netPremium: 0,
    sellPremium: 0
  });
  
  // Totales
  const [totals, setTotals] = useState({ origin: 0, freight: 0, local: 0, localIva: 0, inland: 0, insurance: 0, profit: 0 });
  
  // Texto e Archivo Input para IA
  const [aiText, setAiText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef(null);

  // --- CALCULO DE CARGA ---
  const calculatedCW = cargoLines.reduce((acc, line) => {
    const qty = parseFloat(line.qty) || 0;
    const l = parseFloat(line.length) || 0;
    const w = parseFloat(line.width) || 0;
    const h = parseFloat(line.height) || 0;
    const kg = parseFloat(line.weight) || 0;

    const cbm = (l * w * h) / 1000000 * qty;
    const totalKg = kg * qty;

    if (transportType === 'aereo') {
      const volWeight = cbm * 167; 
      return acc + Math.max(totalKg, volWeight);
    } else {
      if (seaType === 'FCL') {
        return acc + qty;
      } else {
        const w_m = Math.max(cbm, totalKg / 1000); 
        return acc + w_m;
      }
    }
  }, 0);

  const finalCW = cwManual !== '' ? parseFloat(cwManual) : (
    transportType === 'aereo' 
      ? Math.ceil(calculatedCW) 
      : (seaType === 'FCL' ? calculatedCW : Number(calculatedCW.toFixed(3)))
  );

  // --- ACTUALIZAR TOTALES Y PROFIT ---
  useEffect(() => {
    let profit = 0;
    
    const sumOrigin = originCosts.reduce((acc, c) => {
      profit += ((parseFloat(c.sell) || 0) - (parseFloat(c.net) || 0));
      return acc + (parseFloat(c.sell) || 0);
    }, 0);
    
    const sumFreight = freightCosts.reduce((acc, c) => {
      const multiplier = c.byCw ? finalCW : 1;
      const netTotal = (parseFloat(c.net) || 0) * multiplier;
      const sellTotal = (parseFloat(c.sell) || 0) * multiplier;
      profit += (sellTotal - netTotal);
      return acc + sellTotal;
    }, 0);
    
    let sumLocal = 0;
    let sumLocalIva = 0;
    localCosts.forEach(c => {
      const sellVal = parseFloat(c.sell) || 0;
      const netVal = parseFloat(c.net) || 0;
      profit += (sellVal - netVal);
      sumLocal += sellVal;
      if (c.addIva) {
        sumLocalIva += (sellVal * 0.21);
      }
    });

    let sumInland = 0;
    if (showInland) {
      inlandCosts.forEach(c => {
        const sellVal = parseFloat(c.sell) || 0;
        const netVal = parseFloat(c.net) || 0;
        profit += (sellVal - netVal);
        sumInland += sellVal;
      });
    }

    let sumInsurance = 0;
    if (showInsurance) {
      const sellVal = parseFloat(insurance.sellPremium) || 0;
      const netVal = parseFloat(insurance.netPremium) || 0;
      profit += (sellVal - netVal);
      sumInsurance = sellVal;
    }

    setTotals({
      origin: sumOrigin,
      freight: sumFreight,
      local: sumLocal,
      localIva: sumLocalIva,
      inland: sumInland,
      insurance: sumInsurance,
      profit: profit
    });
  }, [cargoLines, originCosts, freightCosts, localCosts, inlandCosts, insurance, showInland, showInsurance, cwManual, finalCW, transportType, seaType]);

  // --- MANEJADORES DE LINEAS ---
  const addCargoLine = () => setCargoLines([...cargoLines, { id: Date.now(), type: 'GRAL', qty: 1, length: 100, width: 100, height: 100, weight: 100 }]);
  const removeCargoLine = (id) => setCargoLines(cargoLines.filter(c => c.id !== id));
  const updateCargo = (id, field, value) => {
    setCargoLines(cargoLines.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addCostLine = (setter, state, defaultValues = {}) => {
    setter([...state, { id: Date.now(), name: '', net: 0, sell: 0, ...defaultValues }]);
  };
  const removeCostLine = (setter, state, id) => setter(state.filter(c => c.id !== id));
  const updateCost = (setter, state, id, field, value) => {
    setter(state.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  // Manejador de Seguro
  const handleInsuranceChange = (field, val) => {
    const newIns = { ...insurance, [field]: val };
    if (field === 'merchValue' || field === 'netRate' || field === 'sellRate') {
      const v = parseFloat(newIns.merchValue) || 0;
      newIns.netPremium = (v * (parseFloat(newIns.netRate) || 0) / 100).toFixed(2);
      newIns.sellPremium = (v * (parseFloat(newIns.sellRate) || 0) / 100).toFixed(2);
    }
    setInsurance(newIns);
  };

  // Manejador de Archivos
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      setFileBase64({
        mimeType: file.type || 'image/png',
        data: base64
      });
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFileBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Botones Rápidos
  const addAirlineCharges = () => {
    if(transportType !== 'aereo') return;
    setFreightCosts([
      ...freightCosts,
      { id: Date.now()+1, name: 'FSC', net: 0, sell: 0, byCw: true },
      { id: Date.now()+2, name: 'SSC', net: 0, sell: 0, byCw: true }
    ]);
  };
  const addHAWB = () => setFreightCosts([...freightCosts, { id: Date.now(), name: 'HAWB Fee', net: 0, sell: 0, byCw: false }]);

  // Generador de Email Formal
  const generateEmail = () => {
    let gralCount = 0;
    let imoCount = 0;
    cargoLines.forEach(c => {
      if (c.type === 'GRAL') gralCount += parseFloat(c.qty) || 0;
      if (c.type === 'IMO') imoCount += parseFloat(c.qty) || 0;
    });
    
    let desc = [];
    if (gralCount > 0) desc.push(`${gralCount} ${transportType==='maritimo' && seaType==='FCL' ? 'Contenedores' : 'pallets/bultos'} GRAL`);
    if (imoCount > 0) desc.push(`${imoCount} ${transportType==='maritimo' && seaType==='FCL' ? 'Contenedores' : 'pallets/bultos'} IMO`);

    let text = `Estimado cliente,\n\nAdjuntamos nuestra mejor cotización para su carga de ${desc.join(' y ')}.\n\n`;
    text += `Detalles del servicio (${transportType.toUpperCase()}${transportType==='maritimo' ? ' ' + seaType : ''}):\n`;
    text += `- ${transportType==='aereo' ? 'Chargeable Weight (CW)' : (seaType==='FCL' ? 'Cantidad Equipos' : 'W/M')}: ${finalCW}\n\n`;
    
    if (totals.origin > 0) text += `Gastos en Origen:\nTotal: USD ${totals.origin.toFixed(2)}\n\n`;
    if (totals.freight > 0) text += `Flete Internacional:\nTotal: USD ${totals.freight.toFixed(2)}\n\n`;
    if (showInland && totals.inland > 0) text += `Flete Terrestre (Inland):\nTotal: USD ${totals.inland.toFixed(2)}\n\n`;
    if (showInsurance && totals.insurance > 0) {
      text += `Seguro Internacional:\nTotal: USD ${totals.insurance.toFixed(2)} (S/ Valor ${insurance.currency} ${insurance.merchValue})\n\n`;
    }
    if (totals.local > 0) text += `Gastos Locales en Destino:\nTotal: USD ${totals.local.toFixed(2)} + IVA\n\n`;
    
    text += `Quedamos a su entera disposición ante cualquier consulta.\nSaludos cordiales.`;
    return text;
  };

  // --- PROCESAMIENTO CON GEMINI IA MULTIMODAL ---
  const handleIA = async () => {
    if (!aiText.trim() && !fileBase64) {
      return alert("Por favor ingresa texto o adjunta una imagen/archivo con la cotización.");
    }

    setIsProcessing(true);

    try {
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const promptParts = [];
      
      if (fileBase64) {
        promptParts.push({
          inlineData: {
            mimeType: fileBase64.mimeType,
            data: fileBase64.data
          }
        });
      }

      promptParts.push({
        text: `Analiza esta cotización logística internacional (Aéreo o Marítimo LCL/FCL) proveniente de texto o documento/imagen.
Extrae la información y responde ÚNICAMENTE con un objeto JSON respetando el siguiente esquema exacto.

TEXTO ADICIONAL:
${aiText || 'Ver archivo adjunto.'}`
      });

      const payload = {
        contents: [{ role: 'user', parts: promptParts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              transportType: { type: "STRING", enum: ["aereo", "maritimo"] },
              seaType: { type: "STRING", enum: ["LCL", "FCL"] },
              cargoLines: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    type: { type: "STRING", enum: ["GRAL", "IMO"] },
                    qty: { type: "NUMBER" },
                    length: { type: "NUMBER" },
                    width: { type: "NUMBER" },
                    height: { type: "NUMBER" },
                    weight: { type: "NUMBER" }
                  },
                  required: ["type", "qty", "length", "width", "height", "weight"]
                }
              },
              cwSuggested: { type: "NUMBER" },
              originCosts: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    net: { type: "NUMBER" },
                    sell: { type: "NUMBER" }
                  },
                  required: ["name", "net", "sell"]
                }
              },
              freightCosts: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    net: { type: "NUMBER" },
                    sell: { type: "NUMBER" },
                    byCw: { type: "BOOLEAN" }
                  },
                  required: ["name", "net", "sell", "byCw"]
                }
              },
              inlandCosts: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    net: { type: "NUMBER" },
                    sell: { type: "NUMBER" }
                  },
                  required: ["name", "net", "sell"]
                }
              },
              insurance: {
                type: "OBJECT",
                properties: {
                  merchValue: { type: "NUMBER" },
                  currency: { type: "STRING" },
                  netRate: { type: "NUMBER" },
                  sellRate: { type: "NUMBER" },
                  netPremium: { type: "NUMBER" },
                  sellPremium: { type: "NUMBER" }
                }
              },
              localCosts: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    net: { type: "NUMBER" },
                    sell: { type: "NUMBER" },
                    addIva: { type: "BOOLEAN" }
                  },
                  required: ["name", "net", "sell", "addIva"]
                }
              }
            },
            required: ["transportType", "seaType", "cargoLines", "originCosts", "freightCosts", "localCosts"]
          }
        },
        systemInstruction: {
          parts: [{
            text: `Eres un cotizador experto de Freight Forwarder. Analiza cotizaciones aéreas y marítimas (LCL / FCL) en cualquier formato.
REGLAS VITALES:
1. transportType: "aereo" o "maritimo". Si es marítimo, clasifica seaType como "LCL" o "FCL".
2. Clasifica cada ítem de carga como "GRAL" o "IMO". Si no indica IMO, es GRAL.
3. Extrae bultos, dimensiones en cm (L x W x H) y peso por bulto en kg. Si es FCL o LCL sin dimensiones, asigna valores acordes.
4. Para aéreo, si hay tarifa con mínimo (ej. Min 45kg) o salto de escala (+100, +300, +500, +1000) que convenga aplicar, define cwSuggested con el peso cobrable final.
5. Desglosa los costos en:
   - originCosts: pick up origen, export handling, EXW charges, etc.
   - freightCosts: flete marítimo/aéreo base, FSC, SSC, MZC, BAF, GRI, HAWB/BL fee, THC origen si se cobra con flete. byCw=true si se cobra por kg/WM/contenedor.
   - inlandCosts: flete terrestre nacional u opcional.
   - insurance: cotización o costo de seguro si existe.
   - localCosts: gastos locales en destino (THC destino, debarcado, desconsolidación, cesión de BL, manejo, etc.).
6. Si un costo no distingue Neto y Venta, asigna el mismo valor a ambos.`
          }]
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!jsonText) {
        throw new Error("No se obtuvo respuesta estructurada de la IA.");
      }

      const parsed = JSON.parse(jsonText);

      // Aplicar estado extraído
      if (parsed.transportType) setTransportType(parsed.transportType);
      if (parsed.seaType) setSeaType(parsed.seaType);

      if (parsed.cargoLines && parsed.cargoLines.length > 0) {
        setCargoLines(parsed.cargoLines.map((c, idx) => ({ ...c, id: Date.now() + idx })));
      }

      if (parsed.cwSuggested && parsed.cwSuggested > 0) {
        setCwManual(parsed.cwSuggested.toString());
      } else {
        setCwManual('');
      }

      if (parsed.originCosts) {
        setOriginCosts(parsed.originCosts.map((c, idx) => ({ ...c, id: Date.now() + idx })));
      }

      if (parsed.freightCosts) {
        setFreightCosts(parsed.freightCosts.map((c, idx) => ({ ...c, id: Date.now() + idx })));
      }

      if (parsed.inlandCosts && parsed.inlandCosts.length > 0) {
        setInlandCosts(parsed.inlandCosts.map((c, idx) => ({ ...c, id: Date.now() + idx })));
        setShowInland(true);
      }

      if (parsed.insurance && (parsed.insurance.merchValue > 0 || parsed.insurance.sellPremium > 0)) {
        setInsurance(parsed.insurance);
        setShowInsurance(true);
      }

      if (parsed.localCosts) {
        setLocalCosts(parsed.localCosts.map((c, idx) => ({ ...c, id: Date.now() + idx })));
      }

    } catch (error) {
      console.error("Error al procesar con IA:", error);
      alert("Hubo un problema al analizar la cotización. Verifica la imagen/texto e intentalo nuevamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-sky-950 font-bold text-xl">
            <span>Cotizaciones Argenbaires SRL</span>
          </div>
          <div className="flex gap-4 bg-slate-100 p-2 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
              <input type="radio" name="via" checked={transportType === 'aereo'} onChange={() => setTransportType('aereo')} className="w-4 h-4"/> Aéreo
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
              <input type="radio" name="via" checked={transportType === 'maritimo'} onChange={() => setTransportType('maritimo')} className="w-4 h-4"/> Marítimo
            </label>
            {transportType === 'maritimo' && (
              <select value={seaType} onChange={e => setSeaType(e.target.value)} className="ml-2 bg-white border border-slate-300 rounded px-2 text-sm font-bold text-sky-800 outline-none">
                <option value="LCL">LCL</option>
                <option value="FCL">FCL</option>
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. INPUT IA MULTIMODAL */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <h2 className="font-bold mb-2 text-slate-700">1. Recepción de Datos (Texto / Imagen / PDF)</h2>
              <textarea 
                className="w-full p-2 border rounded-md text-sm mb-2 focus:ring-2 focus:ring-sky-600 focus:outline-none bg-slate-50" 
                rows="4" 
                placeholder="Pega aquí el texto de la cotización aérea o marítima (LCL/FCL)..."
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              ></textarea>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,application/pdf" 
                className="hidden" 
              />

              {selectedFile ? (
                <div className="flex items-center justify-between bg-sky-50 border border-sky-200 p-2 rounded text-sm text-sky-900">
                  <span className="truncate max-w-[250px] font-medium flex items-center gap-1">
                    <FileText className="w-4 h-4" /> {selectedFile.name}
                  </span>
                  <button onClick={removeSelectedFile} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : null}

              <div className="flex gap-2">
                <button 
                  onClick={() => fileInputRef.current && fileInputRef.current.click()} 
                  className="bg-slate-100 px-3 py-2 text-sm rounded border hover:bg-slate-200 flex items-center gap-1 font-semibold text-slate-700 transition-colors flex-1 justify-center"
                >
                  <Upload className="w-4 h-4"/> Subir Imagen / PDF
                </button>
                <button 
                  onClick={handleIA} 
                  disabled={isProcessing} 
                  className="bg-sky-800 text-white px-5 py-2 text-sm rounded hover:bg-sky-900 font-semibold disabled:opacity-50 transition-colors flex items-center gap-2 justify-center flex-1"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Procesando...
                    </>
                  ) : (
                    'Procesar con IA'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 2. DETALLE DE CARGA */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-slate-700">2. Detalle de la Carga</h2>
              <button onClick={addCargoLine} className="text-sky-800 text-sm flex items-center gap-1 hover:underline font-semibold">
                <Plus className="w-4 h-4"/> Bultos / Eq.
              </button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {cargoLines.map(line => (
                <div key={line.id} className="flex flex-wrap gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                  <select value={line.type} onChange={(e)=>updateCargo(line.id, 'type', e.target.value)} className="border p-1 rounded font-semibold text-slate-700 bg-white">
                    <option value="GRAL">GRAL</option>
                    <option value="IMO">IMO</option>
                  </select>
                  <input type="number" value={line.qty} onChange={(e)=>updateCargo(line.id, 'qty', e.target.value)} className="w-14 border p-1 rounded text-center"/> {transportType==='maritimo' && seaType==='FCL' ? 'Eq.' : 'un.'} 
                  {!(transportType==='maritimo' && seaType==='FCL') && (
                    <>
                      de <input type="number" value={line.length} onChange={(e)=>updateCargo(line.id, 'length', e.target.value)} className="w-12 border p-1 rounded text-center" placeholder="L"/> x
                      <input type="number" value={line.width} onChange={(e)=>updateCargo(line.id, 'width', e.target.value)} className="w-12 border p-1 rounded text-center" placeholder="W"/> x
                      <input type="number" value={line.height} onChange={(e)=>updateCargo(line.id, 'height', e.target.value)} className="w-12 border p-1 rounded text-center" placeholder="H"/> cm, 
                      peso: <input type="number" value={line.weight} onChange={(e)=>updateCargo(line.id, 'weight', e.target.value)} className="w-16 border p-1 rounded text-center" placeholder="Kg"/> kg/un.
                    </>
                  )}
                  <button onClick={() => removeCargoLine(line.id)} className="text-red-400 ml-auto hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3 bg-sky-50 p-3 rounded-md border border-sky-100">
              <div className="font-semibold text-sky-950 text-sm">
                {transportType === 'aereo' ? 'Chargeable Weight (CW):' : (seaType === 'FCL' ? 'Cant. Equipos:' : 'W/M (Ton/CBM):')}
              </div>
              <input 
                type="number" 
                value={cwManual !== '' ? cwManual : finalCW} 
                onChange={(e) => setCwManual(e.target.value)} 
                className="w-24 border border-sky-300 p-1.5 rounded font-bold text-center text-sky-950 shadow-inner"
                placeholder="Manual"
              />
              <span className="text-[10px] text-sky-800 leading-tight flex-1">
                (Calc: {transportType==='aereo' ? Math.ceil(calculatedCW) : (seaType==='FCL' ? calculatedCW : Number(calculatedCW.toFixed(3)))}). <br/>Edita si hay tramos (+300) o mínimos.
              </span>
            </div>
          </div>
        </div>

        {/* MODULOS OPCIONALES TOGGLE */}
        <div className="flex gap-3 px-1">
          <button 
            onClick={() => setShowInland(!showInland)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border ${showInland ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
          >
            <Truck className="w-4 h-4" /> {showInland ? 'Flete Terrestre Activado' : '+ Agregar Flete Terrestre'}
          </button>
          <button 
            onClick={() => setShowInsurance(!showInsurance)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border ${showInsurance ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 shadow-sm'}`}
          >
            <Shield className="w-4 h-4" /> {showInsurance ? 'Seguro Activado' : '+ Agregar Seguro'}
          </button>
        </div>

        {/* 3. COSTOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          
          {/* Origen */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-sm text-slate-700">Gastos Origen</h2>
              <button onClick={()=>addCostLine(setOriginCosts, originCosts)} className="text-sky-800 bg-sky-50 p-1 rounded hover:bg-sky-100"><Plus className="w-4 h-4"/></button>
            </div>
            {originCosts.map(c => (
              <div key={c.id} className="flex gap-1 mb-2 items-center text-sm">
                <input value={c.name} onChange={e=>updateCost(setOriginCosts, originCosts, c.id, 'name', e.target.value)} className="flex-1 border p-1.5 rounded" placeholder="Concepto"/>
                <input type="number" value={c.net} onChange={e=>updateCost(setOriginCosts, originCosts, c.id, 'net', e.target.value)} className="w-20 border p-1.5 rounded bg-slate-50" placeholder="Neto"/>
                <input type="number" value={c.sell} onChange={e=>updateCost(setOriginCosts, originCosts, c.id, 'sell', e.target.value)} className="w-20 border p-1.5 rounded font-bold text-sky-800" placeholder="Venta"/>
                <div className="w-16 text-right text-xs font-bold text-emerald-600 bg-emerald-50 py-1 rounded">P: ${(c.sell - c.net).toFixed(0)}</div>
                <button onClick={()=>removeCostLine(setOriginCosts, originCosts, c.id)} className="text-red-400 ml-1"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>

          {/* Flete Internacional */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-sm text-slate-700">Flete y Recargos</h2>
              <div className="flex gap-1">
                <button onClick={addHAWB} className="text-[10px] bg-slate-100 border px-2 py-1 rounded hover:bg-slate-200 font-bold">+ HAWB</button>
                {transportType === 'aereo' && <button onClick={addAirlineCharges} className="text-[10px] bg-slate-100 border px-2 py-1 rounded hover:bg-slate-200 font-bold">+ Carrier</button>}
                <button onClick={()=>addCostLine(setFreightCosts, freightCosts, {byCw: true})} className="text-sky-800 bg-sky-50 p-1 rounded hover:bg-sky-100 ml-1"><Plus className="w-4 h-4"/></button>
              </div>
            </div>
            {freightCosts.map(c => {
              const multiplier = c.byCw ? finalCW : 1;
              const subP = (c.sell - c.net) * multiplier;
              return (
                <div key={c.id} className="flex flex-col gap-1 mb-2 p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                  <div className="flex gap-1 items-center">
                    <input value={c.name} onChange={e=>updateCost(setFreightCosts, freightCosts, c.id, 'name', e.target.value)} className="flex-1 border p-1.5 rounded font-semibold text-slate-700" placeholder="Concepto (ej. Flete, MZC, BAF)"/>
                    <button onClick={()=>removeCostLine(setFreightCosts, freightCosts, c.id)} className="text-red-400"><Trash2 className="w-4 h-4"/></button>
                  </div>
                  <div className="flex gap-1 items-center mt-1">
                    <input type="number" value={c.net} onChange={e=>updateCost(setFreightCosts, freightCosts, c.id, 'net', e.target.value)} className="w-1/4 border p-1.5 rounded bg-white" placeholder="Neto"/>
                    <input type="number" value={c.sell} onChange={e=>updateCost(setFreightCosts, freightCosts, c.id, 'sell', e.target.value)} className="w-1/4 border p-1.5 rounded font-bold text-sky-800 bg-white" placeholder="Venta"/>
                    <label className="text-xs flex items-center gap-1 w-1/5 justify-center font-semibold cursor-pointer">
                      <input type="checkbox" checked={c.byCw} onChange={e=>updateCost(setFreightCosts, freightCosts, c.id, 'byCw', e.target.checked)}/> x CW
                    </label>
                    <div className="flex-1 text-right text-xs font-bold text-emerald-600 bg-emerald-100 py-1.5 px-2 rounded">
                      P: ${subP.toFixed(2)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Flete Terrestre (Opcional) */}
          {showInland && (
            <div className="bg-amber-50 p-4 rounded-xl shadow-sm border border-amber-200">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-sm text-amber-900 flex items-center gap-1"><Truck className="w-4 h-4"/> Flete Terrestre</h2>
                <button onClick={()=>addCostLine(setInlandCosts, inlandCosts)} className="text-amber-700 bg-amber-100 p-1 rounded hover:bg-amber-200"><Plus className="w-4 h-4"/></button>
              </div>
              {inlandCosts.map(c => (
                <div key={c.id} className="flex gap-1 mb-2 items-center text-sm">
                  <input value={c.name} onChange={e=>updateCost(setInlandCosts, inlandCosts, c.id, 'name', e.target.value)} className="flex-1 border p-1.5 rounded" placeholder="Tramo / Concepto"/>
                  <input type="number" value={c.net} onChange={e=>updateCost(setInlandCosts, inlandCosts, c.id, 'net', e.target.value)} className="w-20 border p-1.5 rounded bg-white" placeholder="Neto"/>
                  <input type="number" value={c.sell} onChange={e=>updateCost(setInlandCosts, inlandCosts, c.id, 'sell', e.target.value)} className="w-20 border p-1.5 rounded font-bold text-amber-700 bg-white" placeholder="Venta"/>
                  <div className="w-16 text-right text-xs font-bold text-emerald-600 bg-white py-1 rounded">P: ${(c.sell - c.net).toFixed(0)}</div>
                  <button onClick={()=>removeCostLine(setInlandCosts, inlandCosts, c.id)} className="text-red-400 ml-1"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          )}

          {/* Seguro Internacional (Opcional) */}
          {showInsurance && (
            <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-200">
              <h2 className="font-bold text-sm text-blue-900 flex items-center gap-1 mb-3"><Shield className="w-4 h-4"/> Seguro Internacional</h2>
              
              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-blue-800 mb-1">Moneda</label>
                  <select value={insurance.currency} onChange={e => handleInsuranceChange('currency', e.target.value)} className="w-full border p-1.5 rounded bg-white font-semibold">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-blue-800 mb-1">Valor Mercadería</label>
                  <input type="number" value={insurance.merchValue} onChange={e => handleInsuranceChange('merchValue', e.target.value)} className="w-full border p-1.5 rounded bg-white font-bold text-center" placeholder="Ej: 50000"/>
                </div>
              </div>

              <div className="flex gap-2 items-center text-sm bg-white p-2 rounded border border-blue-100 mb-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Costo (Neto)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={insurance.netRate} onChange={e => handleInsuranceChange('netRate', e.target.value)} className="w-14 border p-1 rounded text-center" step="0.01"/>% = 
                    <input type="number" value={insurance.netPremium} onChange={e => handleInsuranceChange('netPremium', e.target.value)} className="flex-1 border p-1 rounded font-semibold text-slate-700" placeholder="USD N."/>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 items-center text-sm bg-blue-100 p-2 rounded border border-blue-300">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-blue-800 uppercase">Venta al Cliente</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={insurance.sellRate} onChange={e => handleInsuranceChange('sellRate', e.target.value)} className="w-14 border p-1 rounded text-center font-bold text-blue-700" step="0.01"/>% = 
                    <input type="number" value={insurance.sellPremium} onChange={e => handleInsuranceChange('sellPremium', e.target.value)} className="flex-1 border p-1 rounded font-black text-blue-700" placeholder="USD V."/>
                  </div>
                </div>
                <div className="w-16 text-right text-xs font-bold text-emerald-600 bg-white py-2 px-1 rounded shadow-sm">
                  P: ${(parseFloat(insurance.sellPremium || 0) - parseFloat(insurance.netPremium || 0)).toFixed(0)}
                </div>
              </div>
            </div>
          )}

          {/* Locales */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-sm text-slate-700">Gastos Locales</h2>
              <button onClick={()=>addCostLine(setLocalCosts, localCosts, {addIva: true})} className="text-sky-800 bg-sky-50 p-1 rounded hover:bg-sky-100"><Plus className="w-4 h-4"/></button>
            </div>
            {localCosts.map(c => (
              <div key={c.id} className="flex flex-col gap-1 mb-2 p-2 bg-slate-50 rounded border border-slate-200 text-sm">
                <div className="flex gap-1 items-center">
                  <input value={c.name} onChange={e=>updateCost(setLocalCosts, localCosts, c.id, 'name', e.target.value)} className="flex-1 border p-1.5 rounded" placeholder="Concepto local"/>
                  <button onClick={()=>removeCostLine(setLocalCosts, localCosts, c.id)} className="text-red-400"><Trash2 className="w-4 h-4"/></button>
                </div>
                <div className="flex gap-1 items-center mt-1">
                  <input type="number" value={c.net} onChange={e=>updateCost(setLocalCosts, localCosts, c.id, 'net', e.target.value)} className="w-1/4 border p-1.5 rounded bg-white" placeholder="Neto"/>
                  <input type="number" value={c.sell} onChange={e=>updateCost(setLocalCosts, localCosts, c.id, 'sell', e.target.value)} className="w-1/4 border p-1.5 rounded font-bold text-sky-800 bg-white" placeholder="Venta"/>
                  <label className="text-xs flex items-center gap-1 w-1/5 justify-center font-semibold cursor-pointer">
                    <input type="checkbox" checked={c.addIva} onChange={e=>updateCost(setLocalCosts, localCosts, c.id, 'addIva', e.target.checked)}/> + 21%
                  </label>
                  <div className="flex-1 text-right text-xs font-bold text-emerald-600 bg-emerald-100 py-1.5 px-2 rounded">
                    P: ${(c.sell - c.net).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM: PROFIT Y EMAIL */}
        <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-slate-200">
          <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-200 md:w-1/3 flex flex-col justify-center items-center">
            <span className="text-emerald-800 font-bold uppercase text-xs tracking-wider mb-1">Profit Exacto (USD)</span>
            <span className="text-4xl font-black text-emerald-600">${totals.profit.toFixed(2)}</span>
            <span className="text-[10px] text-emerald-700 mt-2 text-center">(Suma todos los márgenes: Origen, Fletes, Seguro y Locales)</span>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 md:w-2/3">
            <h2 className="font-bold mb-2 flex items-center gap-2 text-slate-700"><Mail className="w-5 h-5"/> Borrador Email (Formal)</h2>
            <textarea 
              readOnly 
              className="w-full h-48 p-3 border rounded-md text-sm bg-slate-50 focus:outline-none resize-none font-mono text-slate-700" 
              value={generateEmail()}
            ></textarea>
          </div>
        </div>

      </div>
    </div>
  );
}
