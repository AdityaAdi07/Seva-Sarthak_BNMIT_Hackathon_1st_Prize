"""
YOLO-based Real-Time Crowd Detection Module
Uses YOLOv8 to count people from webcam, video files, or RTSP streams.
Feeds live person count into the WebSocket system.
"""

import cv2
from ultralytics import YOLO
import threading
import time

class CrowdDetector:
    """
    Detects people in video frames using YOLOv8.
    Supports: webcam (0), video file path, or RTSP URL.
    """
    
    def __init__(self, source=0, model_path="yolov8n.pt", confidence=0.35):
        """
        Args:
            source: 0 for webcam, "path/to/video.mp4" for file, "rtsp://..." for IP cam
            model_path: YOLOv8 model weight file (auto-downloads if not present)
            confidence: Detection confidence threshold
        """
        self.source = source
        self.confidence = confidence
        self.model = YOLO(model_path)
        
        # Live state
        self.person_count = 0
        self.density_level = "LOW"  # LOW, MEDIUM, HIGH, CRITICAL
        self.running = False
        self.frame = None  # Latest processed frame (for streaming to frontend)
        self.fps = 0
        self._lock = threading.Lock()
        self._thread = None
    
    def _classify_density(self, count):
        """Classify crowd density based on person count."""
        if count >= 50:
            return "CRITICAL"
        elif count >= 25:
            return "HIGH"
        elif count >= 10:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _detection_loop(self):
        """Main detection loop running in a background thread."""
        cap = cv2.VideoCapture(self.source)
        
        if not cap.isOpened():
            print(f"[ERROR] Could not open video source: {self.source}")
            self.running = False
            return
        
        print(f"[YOLO] Detection started on source: {self.source}")
        
        frame_count = 0
        start_time = time.time()
        
        while self.running:
            ret, frame = cap.read()
            
            if not ret:
                if isinstance(self.source, str) and self.source != "0":
                    # Video file ended — loop it for demo purposes
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    print("[YOLO] Cannot read frame, stopping.")
                    break
            
            # Run YOLO inference
            results = self.model(frame, conf=self.confidence, verbose=False)
            
            # Count only "person" class (class_id = 0 in COCO)
            count = 0
            annotated_frame = frame.copy()
            
            for result in results:
                boxes = result.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    if cls_id == 0:  # person class
                        count += 1
                        # Draw bounding box
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        conf = float(box.conf[0])
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(annotated_frame, f"Person {conf:.1%}", 
                                    (x1, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            
            # Calculate FPS
            frame_count += 1
            elapsed = time.time() - start_time
            fps = frame_count / elapsed if elapsed > 0 else 0
            
            # Draw overlay info on frame
            density = self._classify_density(count)
            color = {
                "LOW": (0, 255, 0),
                "MEDIUM": (0, 255, 255),
                "HIGH": (0, 140, 255),
                "CRITICAL": (0, 0, 255)
            }.get(density, (255, 255, 255))
            
            cv2.rectangle(annotated_frame, (0, 0), (350, 100), (0, 0, 0), -1)
            cv2.putText(annotated_frame, f"Persons: {count}", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            cv2.putText(annotated_frame, f"Density: {density}", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
            cv2.putText(annotated_frame, f"FPS: {fps:.1f}", (10, 90),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
            
            # Update shared state
            with self._lock:
                self.person_count = count
                self.density_level = density
                self.fps = round(fps, 1)
                # Encode frame as JPEG for streaming
                _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                self.frame = buffer.tobytes()
        
        cap.release()
        print("[YOLO] Detection stopped.")
    
    def start(self):
        """Start detection in a background thread."""
        if self.running:
            print("[YOLO] Already running!")
            return
        self.running = True
        self._thread = threading.Thread(target=self._detection_loop, daemon=True)
        self._thread.start()
    
    def stop(self):
        """Stop detection."""
        self.running = False
        if self._thread:
            self._thread.join(timeout=5)
    
    def get_status(self):
        """Get current detection status (thread-safe)."""
        with self._lock:
            return {
                "person_count": self.person_count,
                "density_level": self.density_level,
                "fps": self.fps,
                "source": str(self.source),
                "running": self.running
            }
    
    def get_frame(self):
        """Get latest JPEG frame for video streaming."""
        with self._lock:
            return self.frame

class GateTracker:
    """
    Tracks and counts people crossing a designated line.
    Useful for venue entry/exit footfall.
    """
    def __init__(self, source=0, model_path="yolov8n.pt", line_y=300):
        from tracker import Tracker
        self.source = source
        self.model = YOLO(model_path)
        self.tracker = Tracker()
        self.line_y = int(line_y)
        self.running = False
        
        self.counts = {}
        self.counted_ids = set()
        self.prev_positions = {}
        
        self.frame = None
        self._lock = threading.Lock()
        self._thread = None
        
    def _tracking_loop(self):
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            print(f"[TRACKER] Error opening video {self.source}")
            self.running = False
            return
            
        print(f"[TRACKER] Tracking started on {self.source}")
        
        # Allowed classes
        allowed_classes = ["person", "car", "motorcycle", "bus", "truck", "bicycle"]
        
        while self.running:
            ret, frame = cap.read()
            if not ret:
                if isinstance(self.source, str) and self.source != "0":
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    break
                    
            results = self.model(frame, verbose=False)
            detections = []
            for r in results:
                boxes = r.boxes.xyxy.cpu().numpy()
                classes = r.boxes.cls.cpu().numpy()
                confs = r.boxes.conf.cpu().numpy()
                
                for box, cls, conf in zip(boxes, classes, confs):
                    if conf < 0.3: continue
                    class_name = self.model.names[int(cls)]
                    if class_name not in allowed_classes: continue
                    
                    x1, y1, x2, y2 = map(int, box[:4])
                    w, h = x2 - x1, y2 - y1
                    detections.append([x1, y1, w, h, class_name])
                    
            tracked_objects = self.tracker.update(detections)
            cv2.line(frame, (0, self.line_y), (frame.shape[1], self.line_y), (0, 0, 255), 2)
            
            for obj in tracked_objects:
                x, y, w, h, class_name, obj_id = obj
                cx, cy = x + w // 2, y + h // 2
                
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0,255,0), 2)
                cv2.circle(frame, (cx, cy), 4, (255,0,0), -1)
                cv2.putText(frame, f"{class_name} {obj_id}", (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                if obj_id in self.prev_positions:
                    prev_y = self.prev_positions[obj_id]
                    # Check crossing (TOP to BOTTOM)
                    if prev_y < self.line_y and cy >= self.line_y:
                        if obj_id not in self.counted_ids:
                            self.counts[class_name] = self.counts.get(class_name, 0) + 1
                            self.counted_ids.add(obj_id)
                self.prev_positions[obj_id] = cy
                
            y_offset = 30
            for cls, val in self.counts.items():
                cv2.putText(frame, f"{cls.upper()}: {val}", (50, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                y_offset += 30
                
            with self._lock:
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                self.frame = buffer.tobytes()
                
        cap.release()
        print("[TRACKER] Stopped")
        
    def start(self):
        if self.running: return
        self.running = True
        self._thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self._thread.start()
        
    def stop(self):
        self.running = False
        if self._thread: self._thread.join(timeout=3)
        
    def get_status(self):
        with self._lock:
            return {
                "counts": self.counts.copy(),
                "running": self.running
            }
            
    def get_frame(self):
        with self._lock:
            return self.frame
