# Label and Category Management Story

## 📋 Problem Statement

Currently, the Smart Email Manager has two separate systems for email organization:

1. **Fixed Categories** - System-defined categories (work, personal, marketing, finance, etc.) that are automatically assigned during email sync via `EmailClassificationService`
2. **Custom Labels** - User-created labels stored in `labels.json` that can be manually applied to emails

The current implementation has several limitations:

- **Fixed categories are not visible in the UI** - Users cannot see or manage the system-defined categories (marketing, finance, etc.) in the Custom Labels section
- **No read-only system labels** - There's no way to distinguish between system-created labels (from classification) and user-created custom labels
- **Incomplete category synchronization** - When creating new custom labels, the system doesn't properly filter and update existing emails in ChromaDB based on the label's description and prompt
- **Category metadata inconsistency** - The relationship between labels and categories in ChromaDB metadata needs better management

Users need a unified view where:
- All labels (both fixed system categories and custom labels) are visible in the Custom Labels section
- System-created labels are clearly marked as read-only
- New custom labels automatically filter and update matching emails in ChromaDB
- Category metadata in ChromaDB is properly synchronized with label definitions

## 🎯 Goal

Implement an improved label and category management system that:

1. **Displays all labels in Custom Labels section** - Both fixed system categories and custom user labels
2. **Marks system labels as read-only** - Prevents editing/deletion of system-defined categories
3. **Auto-syncs new custom labels** - When creating a new custom label, automatically filters emails based on description/prompt and updates ChromaDB category metadata
4. **Maintains category consistency** - Ensures ChromaDB metadata category field matches the label name
5. **Provides unified label management** - Single interface for viewing and managing all email organization labels

## 📊 Current System Categories

The following fixed categories are defined in `EmailClassificationService` and should appear as read-only labels:

1. **work** - Professional/work-related emails
2. **personal** - Personal communications from friends/family
3. **promotion** - Marketing emails with sales/discounts
4. **marketing** - Marketing newsletters and campaigns
5. **newsletter** - Subscribed newsletters and updates
6. **notification** - System notifications and alerts
7. **social** - Social media notifications
8. **finance** - Financial and banking communications
9. **spam** - Unsolicited or suspicious emails
10. **other** - Uncategorized emails

These categories are assigned during email sync via the classification service and stored in ChromaDB metadata as the `category` field.

## 🏗️ Architecture Overview

### Current Flow

```
Email Sync → EmailClassificationService → Category Assignment → ChromaDB (category metadata)
                                                                    ↓
User Creates Custom Label → LabelService → Manual Application → ChromaDB (labels + category metadata)
```

### Improved Flow

```
Email Sync → EmailClassificationService → Category Assignment → ChromaDB (category metadata)
                                                                    ↓
System Labels (Read-Only) ← LabelService → Custom Labels (Editable)
                                                                    ↓
Create Custom Label → Filter Emails by Description/Prompt → Update ChromaDB Category Metadata
```

## 🔧 Implementation Plan

### Phase 1: Extend Label Service to Include System Categories

**File**: `python-server/app/services/label_service.py`

**Changes**:
1. Add method to generate system labels from fixed categories
2. Mark system labels with `isSystem: true` flag
3. Merge system labels with custom labels in `get_all_labels()`
4. Prevent editing/deletion of system labels

**Implementation**:

```python
# Add to LabelService class

SYSTEM_CATEGORIES = [
    {"name": "work", "description": "Professional/work-related emails", "color": "#3b82f6"},
    {"name": "personal", "description": "Personal communications from friends/family", "color": "#10b981"},
    {"name": "promotion", "description": "Marketing emails with sales/discounts", "color": "#f59e0b"},
    {"name": "marketing", "description": "Marketing newsletters and campaigns", "color": "#8b5cf6"},
    {"name": "newsletter", "description": "Subscribed newsletters and updates", "color": "#06b6d4"},
    {"name": "notification", "description": "System notifications and alerts", "color": "#6366f1"},
    {"name": "social", "description": "Social media notifications", "color": "#ec4899"},
    {"name": "finance", "description": "Financial and banking communications", "color": "#14b8a6"},
    {"name": "spam", "description": "Unsolicited or suspicious emails", "color": "#ef4444"},
    {"name": "other", "description": "Uncategorized emails", "color": "#6b7280"},
]

def _get_system_labels(self) -> List[Dict[str, Any]]:
    """Generate system labels from fixed categories."""
    system_labels = []
    for category in self.SYSTEM_CATEGORIES:
        label_id = f"system_{category['name']}"
        system_labels.append({
            "id": label_id,
            "name": category["name"],
            "description": category["description"],
            "prompt": f"Emails categorized as {category['name']}",
            "createdAt": "2025-01-01T00:00:00Z",  # System creation date
            "emailCount": 0,  # Will be calculated dynamically
            "color": category["color"],
            "isSystem": True,  # Mark as system label
            "readOnly": True,  # Cannot be edited or deleted
        })
    return system_labels

def get_all_labels(self) -> List[Dict[str, Any]]:
    """Get all labels (system + custom)."""
    system_labels = self._get_system_labels()
    custom_labels = list(self.labels.values())
    
    # Calculate email counts for system labels
    # This requires access to vector_store, so we'll do it in the route handler
    
    # Merge system and custom labels
    all_labels = system_labels + custom_labels
    return all_labels

def get_label(self, label_id: str) -> Optional[Dict[str, Any]]:
    """Get specific label (system or custom)."""
    # Check if it's a system label
    if label_id.startswith("system_"):
        category_name = label_id.replace("system_", "")
        system_labels = self._get_system_labels()
        return next((l for l in system_labels if l["id"] == label_id), None)
    
    # Otherwise, get custom label
    return self.labels.get(label_id)

def update_label(self, label_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update label definition (only for custom labels)."""
    # Prevent updating system labels
    if label_id.startswith("system_"):
        raise ValueError("System labels cannot be updated")
    
    if label_id not in self.labels:
        raise ValueError(f"Label {label_id} not found")
    
    # ... rest of existing update logic

def delete_label(self, label_id: str) -> bool:
    """Delete label definition (only for custom labels)."""
    # Prevent deleting system labels
    if label_id.startswith("system_"):
        raise ValueError("System labels cannot be deleted")
    
    # ... rest of existing delete logic
```

### Phase 2: Update Label Routes to Support System Labels

**File**: `python-server/app/api/routes/labels.py`

**Changes**:
1. Update `get_all_labels` to calculate email counts for system labels
2. Update `get_label` to handle system labels
3. Add validation to prevent editing/deleting system labels

**Implementation**:

```python
@router.get("/labels")
async def get_all_labels(
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Get all labels (system + custom)."""
    try:
        label_service = LabelService(settings)
        all_labels = label_service.get_all_labels()
        
        # Calculate email counts for system labels
        all_emails = vector_store.get_all_emails(limit=None)
        category_counts = {}
        
        for email in all_emails:
            category = email.get("metadata", {}).get("category", "other")
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # Update system label counts
        for label in all_labels:
            if label.get("isSystem"):
                category_name = label["name"]
                label["emailCount"] = category_counts.get(category_name, 0)
        
        return {"success": True, "count": len(all_labels), "labels": all_labels}
    except Exception as exc:
        logger.error("Get labels error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )

@router.get("/labels/{label_id}")
async def get_label(
    label_id: str,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Get specific label (system or custom)."""
    try:
        label_service = LabelService(settings)
        label = label_service.get_label(label_id)
        
        if not label:
            raise HTTPException(status_code=404, detail="Label not found")
        
        # Calculate email count for system labels
        if label.get("isSystem"):
            all_emails = vector_store.get_all_emails(limit=None)
            category_name = label["name"]
            count = sum(
                1
                for email in all_emails
                if email.get("metadata", {}).get("category") == category_name
            )
            label["emailCount"] = count
        
        return {"success": True, "label": label}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )

@router.put("/labels/{label_id}")
async def update_label(
    label_id: str,
    payload: LabelUpdateRequest,
    settings: Settings = Depends(get_settings_dep),
) -> dict:
    """Update label definition (only for custom labels)."""
    try:
        label_service = LabelService(settings)
        
        # Check if it's a system label
        if label_id.startswith("system_"):
            raise HTTPException(
                status_code=403,
                detail="System labels cannot be updated"
            )
        
        updates = payload.dict(exclude_unset=True)
        label = label_service.update_label(label_id, updates)
        return {"success": True, "label": label}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as exc:
        logger.error("Update label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )

@router.delete("/labels/{label_id}")
async def delete_label(
    label_id: str,
    settings: Settings = Depends(get_settings_dep),
) -> dict:
    """Delete label (only for custom labels)."""
    try:
        label_service = LabelService(settings)
        
        # Check if it's a system label
        if label_id.startswith("system_"):
            raise HTTPException(
                status_code=403,
                detail="System labels cannot be deleted"
            )
        
        success = label_service.delete_label(label_id)
        if not success:
            raise HTTPException(status_code=404, detail="Label not found")
        return {"success": True, "message": "Label deleted"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete label error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )
```

### Phase 3: Enhance Custom Label Creation with Auto-Sync

**File**: `python-server/app/services/label_service.py`

**Changes**:
1. Modify `create_label` to automatically filter and update matching emails
2. Add method to filter emails based on description and prompt
3. Update ChromaDB category metadata when label is created

**Implementation**:

```python
async def create_label(
    self, name: str, description: str, prompt: str, color: Optional[str] = None,
    vector_store: Optional[VectorStore] = None,
    auto_apply: bool = True,  # New parameter
) -> Dict[str, Any]:
    """Create a new label definition and auto-apply to matching emails."""
    label_id = f"label_{uuid.uuid4().hex[:12]}"

    label = {
        "id": label_id,
        "name": name,
        "description": description,
        "prompt": prompt,
        "createdAt": datetime.utcnow().isoformat(),
        "emailCount": 0,
        "color": color or "#6b7280",
        "isSystem": False,
        "readOnly": False,
    }

    self.labels[label_id] = label
    self._save_labels()

    # Auto-apply label to existing emails if requested
    if auto_apply and vector_store:
        logger.info("Auto-applying new label '%s' to existing emails...", name)
        count = await self.auto_apply_label(label_id, vector_store)
        label["emailCount"] = count
        self._save_labels()

    logger.info("Created label '%s' (ID: %s)", name, label_id)
    return label

async def auto_apply_label(self, label_id: str, vector_store: Optional[VectorStore] = None) -> int:
    """Automatically apply label to all matching emails in ChromaDB."""
    if label_id not in self.labels:
        raise ValueError(f"Label {label_id} not found")

    label = self.labels[label_id]

    if not vector_store:
        from app.api.deps import get_vector_store
        vector_store = get_vector_store()

    # Get all emails from ChromaDB
    all_emails = vector_store.get_all_emails(limit=None)
    logger.info("Checking %s emails against label '%s'...", len(all_emails), label["name"])

    matching_emails = []
    skipped_already_labeled = 0
    
    for email_data in all_emails:
        email_id = email_data.get("id")
        metadata = email_data.get("metadata", {})

        # Check if email already has this label
        existing_labels_str = metadata.get("labels", "")
        existing_labels = [l.strip() for l in existing_labels_str.split(",") if l.strip()]
        if label_id in existing_labels:
            skipped_already_labeled += 1
            continue

        # Check if email matches label criteria using AI
        email_dict = {
            "id": email_id,
            "from": metadata.get("from"),
            "subject": metadata.get("subject"),
            "body": email_data.get("document"),
            "snippet": metadata.get("snippet"),
        }

        if await self._email_matches_label(email_dict, label):
            matching_emails.append(email_id)
            logger.debug("Email %s matches label '%s' criteria", email_id, label["name"])
    
    logger.info("Found %s matching emails, %s already have this label, %s will be updated", 
               len(matching_emails), skipped_already_labeled, len(matching_emails))

    # Update emails in ChromaDB with new label and category
    if matching_emails:
        updated_count = await self._update_emails_with_label(vector_store, matching_emails, label_id)
        
        # Update label count based on actual emails with this label in ChromaDB
        all_emails_after = vector_store.get_all_emails(limit=None)
        actual_count = sum(
            1
            for email in all_emails_after
            if label_id in (email.get("metadata", {}).get("labels", "") or "").split(",")
        )
        label["emailCount"] = actual_count
        self._save_labels()
        logger.info("Applied label '%s' to %s emails (updated %s, total now: %s)", 
                   label["name"], len(matching_emails), updated_count, actual_count)
        return updated_count

    logger.info("No matching emails found for label '%s'", label["name"])
    return 0

async def _update_emails_with_label(
    self, vector_store: VectorStore, email_ids: List[str], label_id: str
) -> int:
    """Update emails in ChromaDB with new label. Label becomes the email category (classification)."""
    if label_id not in self.labels:
        raise ValueError(f"Label {label_id} not found")
    
    label = self.labels[label_id]
    label_name = label.get("name", label_id).lower()  # Use label name as category
    
    collection = vector_store.get_collection()
    updated_count = 0

    for email_id in email_ids:
        try:
            # Get current email data with all metadata
            result = collection.get(ids=[email_id], include=["metadatas", "documents"])
            if not result.get("ids"):
                continue

            old_metadata = result["metadatas"][0]
            old_category = old_metadata.get("category", "other")
            old_labels = old_metadata.get("labels", "")
            
            # Create new metadata dict with all existing fields
            # Label becomes the category (email classification)
            new_metadata = {
                "subject": old_metadata.get("subject", "No subject"),
                "from": old_metadata.get("from", "Unknown"),
                "to": old_metadata.get("to", ""),
                "date": old_metadata.get("date", ""),
                "threadId": old_metadata.get("threadId", ""),
                "snippet": old_metadata.get("snippet", ""),
                "labels": label_id,  # Store label ID in labels field
                "important": old_metadata.get("important", "false"),
                "category": label_name,  # Label name becomes the category (classification)
                "categoryConfidence": "0.9",  # High confidence since user explicitly applied label
            }
            
            # Log what we're doing
            if old_category != label_name:
                logger.debug("Replacing old category '%s' with new label category '%s' for email %s", 
                           old_category, label_name, email_id)
            if old_labels and old_labels != label_id:
                logger.debug("Replacing old labels '%s' with new label '%s' for email %s", 
                           old_labels, label_id, email_id)

            # Update in ChromaDB with the new metadata
            collection.update(ids=[email_id], metadatas=[new_metadata])
            updated_count += 1
            logger.debug("Updated email %s: category='%s' (label: %s)", email_id, label_name, label_id)
        except Exception as e:
            logger.warning("Error updating email %s with label: %s", email_id, e)

    return updated_count
```

### Phase 4: Update Label Creation Route

**File**: `python-server/app/api/routes/labels.py`

**Changes**:
1. Pass `vector_store` to `create_label` for auto-sync
2. Enable auto-apply by default

**Implementation**:

```python
@router.post("/labels")
async def create_label(
    payload: LabelCreateRequest,
    settings: Settings = Depends(get_settings_dep),
    vector_store: VectorStore = Depends(get_vector_store),
) -> dict:
    """Create a new label definition and auto-apply to matching emails."""
    try:
        label_service = LabelService(settings)
        label = await label_service.create_label(
            name=payload.name,
            description=payload.description,
            prompt=payload.prompt,
            color=payload.color,
            vector_store=vector_store,  # Pass vector_store for auto-sync
            auto_apply=True,  # Auto-apply to matching emails
        )
        return {"success": True, "label": label}
    except Exception as exc:
        logger.error("Label creation error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(exc)},
        )
```

### Phase 5: Update UI to Show System Labels

**File**: `web-app/app.js`

**Changes**:
1. Display system labels with read-only indicators
2. Disable edit/delete buttons for system labels
3. Show visual distinction between system and custom labels

**Implementation**:

```javascript
displayLabels() {
    const labelsList = document.getElementById('labelsList');
    if (!labelsList) return;

    if (!this.allLabels || this.allLabels.length === 0) {
        labelsList.innerHTML = '<div style="color: #64748b; font-size: 0.9rem; padding: 10px; text-align: center;">No labels yet. Create one to get started!</div>';
        return;
    }

    // Separate system and custom labels
    const systemLabels = this.allLabels.filter(l => l.isSystem);
    const customLabels = this.allLabels.filter(l => !l.isSystem);

    let html = '';

    // Display system labels section
    if (systemLabels.length > 0) {
        html += '<div class="labels-section-header">System Categories (Read-Only)</div>';
        html += systemLabels.map(label => {
            const color = label.color || '#6b7280';
            return `
                <div class="label-item label-item-system" data-label-id="${label.id}">
                    <div class="label-item-header">
                        <span class="label-badge" style="background-color: ${color};">
                            ${label.name}
                            <span class="label-system-badge" title="System label - read only">🔒</span>
                        </span>
                        <span class="label-email-count">${label.emailCount || 0} emails</span>
                    </div>
                    <div class="label-item-description">${label.description || ''}</div>
                    <div class="label-item-actions">
                        <span class="label-readonly-note">System category - cannot be edited</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Display custom labels section
    if (customLabels.length > 0) {
        html += '<div class="labels-section-header">Custom Labels</div>';
        html += customLabels.map(label => {
            const color = label.color || '#6b7280';
            return `
                <div class="label-item" data-label-id="${label.id}">
                    <div class="label-item-header">
                        <span class="label-badge" style="background-color: ${color};">
                            ${label.name}
                        </span>
                        <span class="label-email-count">${label.emailCount || 0} emails</span>
                    </div>
                    <div class="label-item-description">${label.description || ''}</div>
                    <div class="label-item-actions">
                        <button class="apply-label-btn action-btn btn-secondary btn-small" data-label-id="${label.id}" title="Apply this label to matching emails">
                            Apply
                        </button>
                        <button class="delete-label-btn action-btn btn-danger btn-small" data-label-id="${label.id}" title="Delete this label">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    labelsList.innerHTML = html;
}
```

### Phase 6: Add UI Styles for System Labels

**File**: `web-app/style.css`

**Changes**:
1. Add styles for system label indicators
2. Style read-only labels differently

**Implementation**:

```css
/* System Labels Styling */
.label-item-system {
    opacity: 0.95;
    border-left: 3px solid #6366f1;
}

.label-system-badge {
    font-size: 0.75rem;
    margin-left: 4px;
    opacity: 0.7;
}

.labels-section-header {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 20px 0 10px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
}

.label-readonly-note {
    font-size: 0.75rem;
    color: #94a3b8;
    font-style: italic;
}

.label-item-system .label-item-actions {
    pointer-events: none;
}
```

## 📝 Data Model Changes

### Label Model Extension

**File**: `python-server/app/models/emails.py`

**Changes**:
1. Add optional `isSystem` and `readOnly` fields to `LabelResponse`

**Implementation**:

```python
class LabelResponse(BaseModel):
    id: str
    name: str
    description: str
    prompt: str
    createdAt: str
    emailCount: int
    color: Optional[str] = None
    updatedAt: Optional[str] = None
    isSystem: Optional[bool] = False  # NEW: Indicates system-created label
    readOnly: Optional[bool] = False  # NEW: Indicates if label can be edited/deleted
```

## 🔄 Migration Strategy

### Step 1: Backward Compatibility
- Existing custom labels remain unchanged
- System labels are generated on-the-fly (not stored in `labels.json`)
- No data migration required

### Step 2: Gradual Rollout
1. Deploy backend changes (Phases 1-4)
2. Test label creation with auto-sync
3. Deploy UI changes (Phases 5-6)
4. Verify system labels display correctly

### Step 3: User Communication
- Update UI to clearly indicate system vs custom labels
- Show helpful tooltips explaining read-only status
- Document the difference between system categories and custom labels

## ✅ Testing Checklist

### Backend Tests
- [ ] System labels are generated correctly
- [ ] System labels cannot be updated
- [ ] System labels cannot be deleted
- [ ] Custom labels can be created, updated, and deleted
- [ ] Custom label creation auto-applies to matching emails
- [ ] Email counts are calculated correctly for system labels
- [ ] ChromaDB category metadata is updated when custom label is applied
- [ ] Label filtering by description/prompt works correctly

### Frontend Tests
- [ ] System labels display with read-only indicator
- [ ] Custom labels display with edit/delete buttons
- [ ] System labels cannot be edited or deleted via UI
- [ ] Label sections are clearly separated
- [ ] Email counts display correctly for all labels

### Integration Tests
- [ ] Creating a custom label filters and updates matching emails
- [ ] System labels show correct email counts from ChromaDB
- [ ] Label application updates ChromaDB category metadata
- [ ] UI reflects changes after label operations

## 🎯 Success Criteria

1. ✅ All system categories (work, personal, marketing, finance, etc.) are visible in Custom Labels section
2. ✅ System labels are clearly marked as read-only
3. ✅ Custom labels can be created and automatically applied to matching emails
4. ✅ ChromaDB category metadata is updated when custom labels are applied
5. ✅ Email counts are accurate for both system and custom labels
6. ✅ UI clearly distinguishes between system and custom labels
7. ✅ No breaking changes to existing label functionality

## 📚 Related Files

### Backend
- `python-server/app/services/label_service.py` - Label service logic
- `python-server/app/api/routes/labels.py` - Label API routes
- `python-server/app/models/emails.py` - Label models
- `python-server/app/services/email_classification.py` - Category definitions
- `python-server/app/services/vector_store.py` - ChromaDB operations

### Frontend
- `web-app/app.js` - Label management UI logic
- `web-app/style.css` - Label styling
- `web-app/index.html` - Label UI structure

## 🚀 Future Enhancements

1. **Label Templates** - Pre-defined label templates for common use cases
2. **Label Analytics** - Statistics on label usage and email distribution
3. **Bulk Label Operations** - Apply/remove multiple labels at once
4. **Label Rules** - Advanced rules engine for automatic label assignment
5. **Label Export/Import** - Share label definitions between users
6. **Category Customization** - Allow users to customize system category colors/descriptions (while keeping them read-only)

## 📖 User Guide

### Viewing All Labels
- Navigate to the Custom Labels section
- System categories appear at the top with a lock icon (🔒)
- Custom labels appear below with edit/delete options

### Creating a Custom Label
1. Click "Create New Label"
2. Enter label name, description, and prompt
3. Choose a color (optional)
4. Click "Create Label"
5. The system will automatically:
   - Filter emails matching the description/prompt
   - Apply the label to matching emails
   - Update ChromaDB category metadata

### Understanding System Labels
- System labels are automatically created from email categories
- They represent the fixed categories used during email classification
- They cannot be edited or deleted
- Email counts are calculated from ChromaDB category metadata

### Custom Label Management
- Custom labels can be edited (name, description, prompt, color)
- Custom labels can be deleted (removes from all emails)
- Custom labels can be manually applied to specific emails
- Custom labels automatically update ChromaDB category metadata

---

**Story Status**: Ready for Implementation
**Priority**: High
**Estimated Effort**: 2-3 days
**Dependencies**: None (can be implemented independently)

