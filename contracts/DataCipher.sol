// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, eaddress, ebool, euint32, externalEaddress, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title DataCipher
/// @notice Encrypted database storage with an encrypted key and encrypted numeric entries.
contract DataCipher is ZamaEthereumConfig {
    struct Database {
        string name;
        address owner;
        eaddress encryptedKey;
        euint32[] entries;
        bool exists;
    }

    uint256 private _databaseCount;
    mapping(uint256 => Database) private _databases;
    mapping(address => uint256[]) private _ownerDatabases;

    event DatabaseCreated(uint256 indexed databaseId, address indexed owner, string name);
    event EntryAdded(uint256 indexed databaseId, address indexed owner, uint256 index);

    function createDatabase(
        string calldata name,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external returns (uint256) {
        require(bytes(name).length > 0, "Name required");

        eaddress key = FHE.fromExternal(encryptedKey, inputProof);

        uint256 databaseId = _databaseCount;
        _databaseCount += 1;

        Database storage db = _databases[databaseId];
        db.name = name;
        db.owner = msg.sender;
        db.encryptedKey = key;
        db.exists = true;
        _ownerDatabases[msg.sender].push(databaseId);

        FHE.allowThis(db.encryptedKey);
        FHE.allow(db.encryptedKey, msg.sender);

        emit DatabaseCreated(databaseId, msg.sender, name);
        return databaseId;
    }

    function addEntry(
        uint256 databaseId,
        externalEuint32 encryptedValue,
        externalEaddress encryptedKey,
        bytes calldata inputProof
    ) external {
        Database storage db = _databases[databaseId];
        require(db.exists, "Database not found");
        require(db.owner == msg.sender, "Not owner");

        euint32 value = FHE.fromExternal(encryptedValue, inputProof);
        eaddress key = FHE.fromExternal(encryptedKey, inputProof);

        ebool matches = FHE.eq(db.encryptedKey, key);
        euint32 storedValue = FHE.select(matches, value, FHE.asEuint32(0));

        db.entries.push(storedValue);

        FHE.allowThis(storedValue);
        FHE.allow(storedValue, msg.sender);

        emit EntryAdded(databaseId, msg.sender, db.entries.length - 1);
    }

    function getDatabase(
        uint256 databaseId
    ) external view returns (string memory name, address owner, uint256 entryCount) {
        Database storage db = _databases[databaseId];
        require(db.exists, "Database not found");
        return (db.name, db.owner, db.entries.length);
    }

    function getDatabaseKey(uint256 databaseId) external view returns (eaddress) {
        Database storage db = _databases[databaseId];
        require(db.exists, "Database not found");
        return db.encryptedKey;
    }

    function getEntries(uint256 databaseId) external view returns (euint32[] memory) {
        Database storage db = _databases[databaseId];
        require(db.exists, "Database not found");
        return db.entries;
    }

    function getEntry(uint256 databaseId, uint256 index) external view returns (euint32) {
        Database storage db = _databases[databaseId];
        require(db.exists, "Database not found");
        require(index < db.entries.length, "Index out of bounds");
        return db.entries[index];
    }

    function getDatabaseIds(address owner) external view returns (uint256[] memory) {
        return _ownerDatabases[owner];
    }

    function databaseCount() external view returns (uint256) {
        return _databaseCount;
    }
}
