// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AcademicCertificate {

    address public owner;

    struct Certificate {
        string certificateId;
        bytes32 certificateHash;
        address issuer;
        uint256 issueDate;
        bool exists;
        bool revoked;
    }

    mapping(string => Certificate) private certificates;
    mapping(address => bool) public authorizedIssuers;

    event CertificateIssued(
        string certificateId,
        bytes32 certificateHash,
        address issuer
    );

    event CertificateRevoked(
        string certificateId,
        address issuer
    );

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    function authorizeIssuer(address issuer) public onlyOwner {
        require(issuer != address(0), "Invalid issuer address");
        authorizedIssuers[issuer] = true;
    }

    function issueCertificate(
        string memory certificateId,
        bytes32 certificateHash
    ) public onlyAuthorizedIssuer {

        require(bytes(certificateId).length > 0, "Certificate ID required");
        require(!certificates[certificateId].exists, "Certificate already exists");

        certificates[certificateId] = Certificate({
            certificateId: certificateId,
            certificateHash: certificateHash,
            issuer: msg.sender,
            issueDate: block.timestamp,
            exists: true,
            revoked: false
        });

        emit CertificateIssued(
            certificateId,
            certificateHash,
            msg.sender
        );
    }

    function verifyCertificate(
        string memory certificateId
    )
        public
        view
        returns (
            bool exists,
            bytes32 certificateHash,
            address issuer,
            uint256 issueDate,
            bool revoked
        )
    {
        Certificate memory cert = certificates[certificateId];

        return (
            cert.exists,
            cert.certificateHash,
            cert.issuer,
            cert.issueDate,
            cert.revoked
        );
    }

    function revokeCertificate(
        string memory certificateId
    ) public onlyAuthorizedIssuer {

        require(certificates[certificateId].exists, "Certificate not found");

        require(
            msg.sender == owner ||
            msg.sender == certificates[certificateId].issuer,
            "Not permitted to revoke"
        );

        certificates[certificateId].revoked = true;

        emit CertificateRevoked(certificateId, msg.sender);
    }
}